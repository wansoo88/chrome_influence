import type { CreatorRef, VideoMeta } from '@/shared/types';

/**
 * YouTube Data API v3 클라이언트.
 *
 * 쿼터 주의: search.list = 100 units/call. 기본 무료 10,000 units/일로 하루 100회 검색 가능.
 * 채널·영상 세부 조회는 1 unit/call.
 *
 * 모든 호출은 사용자 BYOK 키로 이루어짐. 우리 서버 없음.
 */

const BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * 키워드로 인기 채널 발굴. relevanceLanguage/regionCode 옵션으로 지역·언어 편향.
 * 반환: 최대 N명의 채널 핸들/ID.
 */
export async function searchCreatorsByKeywords(params: {
  apiKey: string;
  keywords: string[];
  language?: string;
  regionCode?: string;
  maxPerKeyword?: number;
}): Promise<CreatorRef[]> {
  const { apiKey, keywords, language, regionCode, maxPerKeyword = 10 } = params;
  const out: Map<string, CreatorRef> = new Map();

  for (const q of keywords) {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('maxResults', String(maxPerKeyword));
    url.searchParams.set('q', q);
    url.searchParams.set('order', 'relevance');
    if (language) url.searchParams.set('relevanceLanguage', language);
    if (regionCode) url.searchParams.set('regionCode', regionCode);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw await toYtError(res);
    const data = (await res.json()) as {
      items?: { id: { channelId: string }; snippet: { title: string; thumbnails?: { default?: { url?: string } } } }[];
    };
    const now = Date.now();
    for (const item of data.items ?? []) {
      const channelId = item.id.channelId;
      if (!channelId || out.has(channelId)) continue;
      out.set(channelId, {
        platform: 'youtube',
        platformId: channelId,
        handle: item.snippet.title,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.default?.url,
        addedAt: now,
        source: 'auto',
      });
    }
  }
  return [...out.values()];
}

/**
 * 채널 ID 배열 → 구독자수·총조회수·최근 업로드 플레이리스트 ID.
 * 쿼터: channels.list = 1 unit. 50 ID까지 한 번에.
 */
export async function hydrateChannels(params: {
  apiKey: string;
  channelIds: string[];
}): Promise<Map<string, { subscribers: number; uploadsPlaylistId: string }>> {
  const { apiKey, channelIds } = params;
  const result = new Map<string, { subscribers: number; uploadsPlaylistId: string }>();
  for (const chunk of chunked(channelIds, 50)) {
    const url = new URL(`${BASE}/channels`);
    url.searchParams.set('part', 'statistics,contentDetails');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw await toYtError(res);
    const data = (await res.json()) as {
      items?: {
        id: string;
        statistics?: { subscriberCount?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }[];
    };
    for (const it of data.items ?? []) {
      const subs = Number(it.statistics?.subscriberCount ?? '0');
      const uploads = it.contentDetails?.relatedPlaylists?.uploads ?? '';
      if (uploads) result.set(it.id, { subscribers: subs, uploadsPlaylistId: uploads });
    }
  }
  return result;
}

/**
 * 최근 영상 메타데이터. uploadsPlaylistId의 playlistItems → videos.list 조합.
 * 쿼터: 각 1 unit × 2번.
 */
export async function fetchRecentVideos(params: {
  apiKey: string;
  creator: CreatorRef;
  uploadsPlaylistId: string;
  limit?: number;
  sinceHours?: number;
}): Promise<VideoMeta[]> {
  const { apiKey, creator, uploadsPlaylistId, limit = 10, sinceHours = 168 } = params;
  const since = Date.now() - sinceHours * 3600 * 1000;

  const url = new URL(`${BASE}/playlistItems`);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('playlistId', uploadsPlaylistId);
  url.searchParams.set('maxResults', String(Math.min(limit, 50)));
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw await toYtError(res);
  const data = (await res.json()) as {
    items?: {
      contentDetails: { videoId: string; videoPublishedAt: string };
      snippet: {
        title: string;
        description: string;
        thumbnails?: { medium?: { url?: string } };
      };
    }[];
  };

  // 기간 필터.
  const fresh = (data.items ?? []).filter(
    (it) => new Date(it.contentDetails.videoPublishedAt).getTime() >= since,
  );
  if (!fresh.length) return [];

  const ids = fresh.map((it) => it.contentDetails.videoId);
  const stats = await fetchVideoStats({ apiKey, videoIds: ids });

  const now = Date.now();
  return fresh.map((it) => {
    const st = stats.get(it.contentDetails.videoId);
    return {
      platform: 'youtube',
      platformId: it.contentDetails.videoId,
      creatorId: creator.platformId,
      title: it.snippet.title,
      description: it.snippet.description,
      publishedAt: it.contentDetails.videoPublishedAt,
      viewCount: st?.views,
      likeCount: st?.likes,
      commentCount: st?.comments,
      thumbnailUrl: it.snippet.thumbnails?.medium?.url,
      url: `https://www.youtube.com/watch?v=${it.contentDetails.videoId}`,
      fetchedAt: now,
    };
  });
}

async function fetchVideoStats(params: {
  apiKey: string;
  videoIds: string[];
}): Promise<Map<string, { views?: number; likes?: number; comments?: number }>> {
  const { apiKey, videoIds } = params;
  const out = new Map<string, { views?: number; likes?: number; comments?: number }>();
  for (const chunk of chunked(videoIds, 50)) {
    const url = new URL(`${BASE}/videos`);
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw await toYtError(res);
    const data = (await res.json()) as {
      items?: {
        id: string;
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }[];
    };
    for (const it of data.items ?? []) {
      out.set(it.id, {
        views: it.statistics?.viewCount ? Number(it.statistics.viewCount) : undefined,
        likes: it.statistics?.likeCount ? Number(it.statistics.likeCount) : undefined,
        comments: it.statistics?.commentCount ? Number(it.statistics.commentCount) : undefined,
      });
    }
  }
  return out;
}

/**
 * 키 검증 — 가장 저렴한 엔드포인트로 왕복.
 */
export async function verifyYouTubeKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', 'test');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString());
    if (res.ok) return { ok: true };
    const body = await readErr(res);
    return { ok: false, error: body };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export class YouTubeError extends Error {
  readonly status: number;
  readonly reason: 'quota' | 'invalid_key' | 'forbidden' | 'generic';
  constructor(status: number, reason: YouTubeError['reason'], message: string) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.name = 'YouTubeError';
  }
}

async function toYtError(res: Response): Promise<YouTubeError> {
  const text = await res.text().catch(() => '');
  let reason: YouTubeError['reason'] = 'generic';
  if (res.status === 400 || res.status === 401) reason = 'invalid_key';
  else if (res.status === 403 && /quota/i.test(text)) reason = 'quota';
  else if (res.status === 403) reason = 'forbidden';
  return new YouTubeError(res.status, reason, text.slice(0, 400));
}

async function readErr(r: Response): Promise<string> {
  try {
    const body = (await r.json()) as { error?: { message?: string } };
    return body?.error?.message ?? `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

function* chunked<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
