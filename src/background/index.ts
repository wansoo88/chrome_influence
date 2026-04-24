import { asServerErr } from '@/shared/messages';
import type {
  ClientMsg,
  DiscoverOk,
  BriefOk,
  VerifyOk,
  ServerMsg,
  Pong,
} from '@/shared/messages';
import {
  getState,
  updateState,
  getApiKeys,
} from '@/shared/storage';
import type { CreatorRef, DailyBrief, VideoMeta } from '@/shared/types';
import {
  fetchRecentVideos,
  hydrateChannels,
  searchCreatorsByKeywords,
  verifyYouTubeKey,
  YouTubeError,
} from './youtube';
import { AiError, summarizeAndCluster, verifyAiKey } from './ai';
import { uid } from '@/shared/id';

/**
 * Service Worker.
 *
 * 책임:
 * - UI 메시지 라우팅
 * - YouTube 발굴 + AI 요약 파이프라인
 * - 라이선스 / 쿼터 관리
 * - 매일 아침 자동 갱신 (chrome.alarms)
 */

const MANIFEST_VERSION = chrome.runtime.getManifest().version;

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.runtime.openOptionsPage().catch(() => void 0);
  }
  scheduleDailyAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleDailyAlarm();
});

async function scheduleDailyAlarm(): Promise<void> {
  const state = await getState();
  const hour = state.settings.autoRefreshHour;
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  chrome.alarms.create('cr-daily-refresh', {
    when: next.getTime(),
    periodInMinutes: 24 * 60,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'cr-daily-refresh') return;
  void autoRefreshActiveCategory();
});

async function autoRefreshActiveCategory(): Promise<void> {
  const state = await getState();
  const activeId = state.settings.activeCategoryId;
  if (!activeId) return;
  try {
    await runDiscoverCreators(activeId);
    await runGenerateBrief(activeId, true);
  } catch {
    // 자동 갱신 실패는 조용히 무시. 다음 트리거에서 재시도.
  }
}

// 새 generate 요청이 오면 이전 AbortController 취소.
let currentOperationAC: AbortController | null = null;

chrome.runtime.onMessage.addListener(
  (msg: ClientMsg, _sender, sendResponse: (res: ServerMsg) => void) => {
    if (!msg || typeof msg !== 'object' || typeof (msg as { kind?: unknown }).kind !== 'string') {
      return false;
    }
    (async () => {
      try {
        switch (msg.kind) {
          case 'ping': {
            const pong: Pong = { kind: 'pong', ok: true, version: MANIFEST_VERSION };
            sendResponse(pong);
            return;
          }
          case 'verifyKey': {
            const merged = { ...(await getApiKeys()), ...(msg.keys ?? {}) };
            if (msg.target === 'youtube') {
              const r = await verifyYouTubeKey(merged.youtube ?? '');
              if (r.ok) {
                const out: VerifyOk = { kind: 'verifyOk', ok: true };
                sendResponse(out);
              } else {
                sendResponse(asServerErr('YT_KEY_INVALID', r.error ?? 'Invalid'));
              }
            } else {
              const r = await verifyAiKey(merged);
              if (r.ok) {
                const out: VerifyOk = { kind: 'verifyOk', ok: true };
                sendResponse(out);
              } else {
                sendResponse(asServerErr('AI_KEY_INVALID', r.error ?? 'Invalid'));
              }
            }
            return;
          }
          case 'discoverCreators': {
            currentOperationAC?.abort();
            const result = await runDiscoverCreators(msg.categoryId);
            sendResponse(result);
            return;
          }
          case 'generateBrief': {
            currentOperationAC?.abort();
            const ac = new AbortController();
            currentOperationAC = ac;
            try {
              const result = await runGenerateBrief(msg.categoryId, msg.forceRefresh ?? false);
              sendResponse(result);
            } finally {
              if (currentOperationAC === ac) currentOperationAC = null;
            }
            return;
          }
          default: {
            const _exhaustive: never = msg;
            void _exhaustive;
            sendResponse(asServerErr('UNKNOWN', 'Unknown message'));
          }
        }
      } catch (e) {
        sendResponse(asServerErr('UNKNOWN', (e as Error).message));
      }
    })();
    return true;
  },
);

async function runDiscoverCreators(categoryId: string): Promise<ServerMsg> {
  const state = await getState();
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat) return asServerErr('CATEGORY_MISSING', 'Category not found');
  const keys = state.apiKeys;
  if (!keys.youtube) return asServerErr('YT_KEY_MISSING', 'YouTube key missing');

  let found: CreatorRef[] = [];
  try {
    found = await searchCreatorsByKeywords({
      apiKey: keys.youtube,
      keywords: cat.keywords,
      language: cat.language === 'auto' ? undefined : cat.language,
      regionCode: cat.regionCode,
      maxPerKeyword: 10,
    });
  } catch (e) {
    return mapYtError(e);
  }

  // 기존 watchlist와 병합 (핸들 기준 중복 제거).
  let added = 0;
  const next = await updateState((s) => {
    const existing = new Set(s.watchlist.map((w) => `${w.platform}:${w.platformId}`));
    for (const c of found) {
      const k = `${c.platform}:${c.platformId}`;
      if (!existing.has(k)) {
        s.watchlist.push(c);
        existing.add(k);
        added++;
      }
    }
  });

  const out: DiscoverOk = {
    kind: 'discoverOk',
    ok: true,
    added,
    total: next.watchlist.length,
  };
  return out;
}

async function runGenerateBrief(categoryId: string, forceRefresh: boolean): Promise<ServerMsg> {
  const state = await getState();
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat) return asServerErr('CATEGORY_MISSING', 'Category not found');
  const keys = state.apiKeys;
  if (!keys.youtube) return asServerErr('YT_KEY_MISSING', 'YouTube key missing');
  if (!keys.aiKey) return asServerErr('AI_KEY_MISSING', 'AI key missing');

  // 캐시 체크: 2시간 이내 브리프가 있고 forceRefresh가 아니면 그대로 반환.
  if (!forceRefresh) {
    const existing = state.briefs.find(
      (b) => b.categoryId === categoryId && Date.now() - b.generatedAt < 2 * 3600 * 1000,
    );
    if (existing) return { kind: 'briefOk', ok: true, brief: existing };
  }

  // Watchlist가 비어있으면 발굴 자동 실행.
  if (state.watchlist.length === 0) {
    const discovered = await runDiscoverCreators(categoryId);
    if (discovered.ok === false) return discovered;
  }

  // 채널 정보 hydration + 최근 영상 수집.
  const channelIds = state.watchlist
    .filter((w) => w.platform === 'youtube')
    .map((w) => w.platformId);

  let hydrated: Map<string, { subscribers: number; uploadsPlaylistId: string }>;
  try {
    hydrated = await hydrateChannels({ apiKey: keys.youtube, channelIds });
  } catch (e) {
    return mapYtError(e);
  }

  const videos: VideoMeta[] = [];
  for (const ref of state.watchlist.filter((w) => w.platform === 'youtube').slice(0, 30)) {
    const info = hydrated.get(ref.platformId);
    if (!info) continue;
    try {
      const vids = await fetchRecentVideos({
        apiKey: keys.youtube,
        creator: ref,
        uploadsPlaylistId: info.uploadsPlaylistId,
        limit: 5,
        sinceHours: 168, // 최근 7일
      });
      videos.push(...vids);
    } catch (e) {
      // 개별 채널 실패는 스킵 (쿼터 초과면 YouTubeError.reason === 'quota'로 터짐 — 그 땐 전체 중단).
      if (e instanceof YouTubeError && e.reason === 'quota') {
        return mapYtError(e);
      }
    }
  }

  // AI 클러스터링 + 요약. category를 프롬프트에 전달 → 언어·톤·키워드 맥락 반영.
  let ai;
  try {
    ai = await summarizeAndCluster({ keys, category: cat, videos });
  } catch (e) {
    if (e instanceof AiError) {
      if (e.code === 'invalid_key') return asServerErr('AI_KEY_INVALID', e.message);
      if (e.code === 'rate_limit') return asServerErr('AI_RATE_LIMIT', e.message);
      if (e.code === 'no_credit') return asServerErr('AI_NO_CREDIT', e.message);
    }
    return asServerErr('UNKNOWN', (e as Error).message);
  }

  const brief: DailyBrief = {
    categoryId,
    generatedAt: Date.now(),
    summary: ai.summary,
    clusters: ai.clusters,
  };

  await updateState((s) => {
    // 영상 캐시 업데이트 (최근 500개만 유지).
    const existingIds = new Set(s.videoCache.map((v) => v.platformId));
    for (const v of videos) {
      if (!existingIds.has(v.platformId)) s.videoCache.push(v);
    }
    if (s.videoCache.length > 500) {
      s.videoCache.sort((a, b) => b.fetchedAt - a.fetchedAt);
      s.videoCache = s.videoCache.slice(0, 500);
    }
    // brief 캐시 업데이트 (최근 7개만 유지).
    s.briefs = s.briefs.filter((b) => b.categoryId !== categoryId).slice(0, 6);
    s.briefs.unshift(brief);
  });

  const out: BriefOk = { kind: 'briefOk', ok: true, brief };
  return out;
}

function mapYtError(e: unknown): ServerMsg {
  if (e instanceof YouTubeError) {
    if (e.reason === 'quota') return asServerErr('YT_QUOTA_EXCEEDED', 'YouTube quota exceeded', e.message);
    if (e.reason === 'invalid_key') return asServerErr('YT_KEY_INVALID', 'YouTube key invalid', e.message);
  }
  return asServerErr('UNKNOWN', (e as Error).message);
}

/**
 * 편의 유틸 — UI가 Options/Popup에서 쓰지 않고 background가 자체 호출하는 path용.
 * 새로 추가되는 스페셜 커맨드가 있을 때 export.
 */
export { uid };
