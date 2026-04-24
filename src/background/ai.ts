import type { ApiKeys, VideoMeta, BriefCluster } from '@/shared/types';
import { uid } from '@/shared/id';

/**
 * AI 클러스터링 + 요약.
 * 비용 최적화: 영상 제목만 전달(설명/댓글 제외) → 토큰 90% 절감.
 * 모델: gpt-4o-mini 기본. 결과는 JSON으로 구조화.
 */

export interface BriefAiResult {
  summary: string; // 5문장
  clusters: BriefCluster[]; // 3~5개
}

export class AiError extends Error {
  readonly code: 'invalid_key' | 'rate_limit' | 'no_credit' | 'generic';
  constructor(code: AiError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'AiError';
  }
}

export async function summarizeAndCluster(params: {
  keys: ApiKeys;
  videos: VideoMeta[];
  myRecentTitles?: string[]; // 갭 리포트용 (내 채널 최근 영상 제목)
}): Promise<BriefAiResult> {
  const { keys, videos, myRecentTitles = [] } = params;
  if (!keys.aiKey) throw new AiError('invalid_key', 'AI key missing');
  if (videos.length === 0) return { summary: 'No new content in the last 24 hours.', clusters: [] };

  const system = [
    'You are organizing a creator-niche daily brief.',
    'Input: an array of recent YouTube video items from top creators in a single niche.',
    'Output JSON:',
    '{ "summary": string (5 concise sentences about what trended in the last 24-168h),',
    '  "clusters": [ { "label": "2-4 word topic label", "videoIds": [videoId, ...] } ] (3-5 clusters) }',
    '',
    'Rules:',
    '- Each video must belong to exactly one cluster.',
    '- Cluster labels must be topical (not generic like "general").',
    '- summary: 5 sentences max, skimmable.',
    '- Return ONLY valid JSON. No prose.',
    myRecentTitles.length > 0
      ? `When you output clusters, also mark "isGap": true if the cluster topic does NOT appear in USER_RECENT_TITLES below. (default false)`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const compact = videos.map((v) => ({
    videoId: v.platformId,
    title: v.title,
    views: v.viewCount,
    published: v.publishedAt,
  }));

  const user = [
    `VIDEOS (${compact.length}):`,
    JSON.stringify(compact),
    myRecentTitles.length > 0
      ? `\nUSER_RECENT_TITLES (${myRecentTitles.length}):\n${JSON.stringify(myRecentTitles.slice(0, 50))}`
      : '',
  ].join('\n');

  const url =
    keys.aiProvider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${keys.aiKey}`,
    'Content-Type': 'application/json',
  };
  if (keys.aiProvider === 'openrouter') {
    headers['HTTP-Referer'] = chrome.runtime.getURL('/');
    headers['X-Title'] = 'CreatorRadar';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: keys.aiModel || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw await toAiError(res);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const parsed = safeJsonParse(raw) as {
    summary?: string;
    clusters?: { label: string; videoIds: string[]; isGap?: boolean }[];
  } | null;
  if (!parsed) {
    throw new AiError('generic', 'AI returned unparseable JSON');
  }

  const clusters: BriefCluster[] = (parsed.clusters ?? [])
    .slice(0, 5)
    .map((c) => ({
      id: uid('cl'),
      label: c.label ?? 'Untitled',
      videoIds: Array.isArray(c.videoIds) ? c.videoIds : [],
      isGap: Boolean(c.isGap),
    }));
  return {
    summary: parsed.summary ?? '',
    clusters,
  };
}

async function toAiError(res: Response): Promise<AiError> {
  const text = await res.text().catch(() => '');
  let msg = text.slice(0, 400);
  try {
    const body = JSON.parse(text) as { error?: { message?: string } };
    if (body?.error?.message) msg = body.error.message;
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) return new AiError('invalid_key', msg);
  if (res.status === 429) return new AiError('rate_limit', msg);
  if (/insufficient|credit|balance|quota/i.test(msg)) return new AiError('no_credit', msg);
  return new AiError('generic', `${res.status}: ${msg}`);
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // 일부 모델이 ``` fenced 블록 포함 시 제거.
    const fenced = s.match(/\{[\s\S]*\}/);
    if (fenced) {
      try {
        return JSON.parse(fenced[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

export async function verifyAiKey(keys: ApiKeys): Promise<{ ok: boolean; error?: string }> {
  if (!keys.aiKey) return { ok: false, error: 'Key missing' };
  try {
    const url =
      keys.aiProvider === 'openrouter'
        ? 'https://openrouter.ai/api/v1/auth/key'
        : 'https://api.openai.com/v1/models';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${keys.aiKey}` },
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return { ok: false, error: (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
