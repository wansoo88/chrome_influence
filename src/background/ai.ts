import type { ApiKeys, BriefCluster, NicheCategory, VideoMeta } from '@/shared/types';
import { uid } from '@/shared/id';
import { buildBriefPrompt, safeJsonParse, type PromptPair } from './prompts';

/**
 * 4개 AI 제공자 통합 계층.
 *
 * 제공자별 차이:
 * - OpenAI:      Chat Completions, response_format: { type: 'json_object' }
 * - Gemini:      generateContent, responseMimeType: 'application/json'
 * - Claude:      Messages API, JSON 네이티브 모드 없음 → 프롬프트로 유도
 * - OpenRouter:  OpenAI 호환 Chat Completions, HTTP-Referer 필요
 *
 * 통합 전략: 프롬프트는 provider 무관. 각 호출 함수가 제공자별 페이로드로 변환.
 */

export interface BriefAiResult {
  summary: string;
  clusters: BriefCluster[];
}

export class AiError extends Error {
  readonly code: 'invalid_key' | 'rate_limit' | 'no_credit' | 'bad_model' | 'generic';
  readonly provider: ApiKeys['aiProvider'];
  readonly status?: number;
  constructor(
    code: AiError['code'],
    provider: ApiKeys['aiProvider'],
    message: string,
    status?: number,
  ) {
    super(message);
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.name = 'AiError';
  }
}

/**
 * Daily Brief 생성 — 프롬프트는 prompts.ts 담당, 여기는 라우팅만.
 */
export async function summarizeAndCluster(params: {
  keys: ApiKeys;
  category: NicheCategory;
  videos: VideoMeta[];
  myRecentTitles?: string[];
}): Promise<BriefAiResult> {
  const { keys, category, videos, myRecentTitles } = params;
  if (!keys.aiKey) throw new AiError('invalid_key', keys.aiProvider, 'AI key missing');
  if (videos.length === 0) {
    return { summary: 'No new content in the last 7 days.', clusters: [] };
  }

  const prompt = buildBriefPrompt({ category, videos, myRecentTitles });
  const raw = await callProvider(keys, prompt);
  const parsed = safeJsonParse(raw) as
    | {
        summary?: string;
        clusters?: { label: string; videoIds: string[]; isGap?: boolean }[];
      }
    | null;
  if (!parsed || typeof parsed !== 'object') {
    throw new AiError('generic', keys.aiProvider, 'AI returned unparseable JSON');
  }
  const clusters: BriefCluster[] = (parsed.clusters ?? [])
    .slice(0, 5)
    .map((c) => ({
      id: uid('cl'),
      label: String(c.label ?? 'Untitled').slice(0, 80),
      videoIds: Array.isArray(c.videoIds) ? c.videoIds.map(String) : [],
      isGap: Boolean(c.isGap),
    }));
  return {
    summary: String(parsed.summary ?? ''),
    clusters,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 제공자별 호출 라우팅
// ──────────────────────────────────────────────────────────────────────────

async function callProvider(keys: ApiKeys, prompt: PromptPair): Promise<string> {
  switch (keys.aiProvider) {
    case 'openai':
      return callOpenAI(keys, prompt);
    case 'gemini':
      return callGemini(keys, prompt);
    case 'claude':
      return callClaude(keys, prompt);
    case 'openrouter':
      return callOpenRouter(keys, prompt);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// OpenAI
// ──────────────────────────────────────────────────────────────────────────

async function callOpenAI(keys: ApiKeys, prompt: PromptPair): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keys.aiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: keys.aiModel || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw await toAiError(res, 'openai');
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

// ──────────────────────────────────────────────────────────────────────────
// Gemini
// ──────────────────────────────────────────────────────────────────────────

async function callGemini(keys: ApiKeys, prompt: PromptPair): Promise<string> {
  const model = keys.aiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(keys.aiKey ?? '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Gemini는 system prompt를 systemInstruction에 별도 필드로.
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) throw await toAiError(res, 'gemini');
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

// ──────────────────────────────────────────────────────────────────────────
// Claude (Anthropic 직접) — CORS 헤더 필요, CWS 심사 리스크 있음
// ──────────────────────────────────────────────────────────────────────────

async function callClaude(keys: ApiKeys, prompt: PromptPair): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': keys.aiKey ?? '',
      'anthropic-version': '2023-06-01',
      // Claude는 브라우저에서 호출하려면 이 헤더가 필수. 사용 시 UI 경고 노출.
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: keys.aiModel || 'claude-3-5-haiku-latest',
      max_tokens: 2048,
      temperature: 0.3,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  });
  if (!res.ok) throw await toAiError(res, 'claude');
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text =
    data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n') ?? '';
  return text;
}

// ──────────────────────────────────────────────────────────────────────────
// OpenRouter (OpenAI 호환)
// ──────────────────────────────────────────────────────────────────────────

async function callOpenRouter(keys: ApiKeys, prompt: PromptPair): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keys.aiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': chrome.runtime.getURL('/'),
      'X-Title': 'CreatorRadar',
    },
    body: JSON.stringify({
      model: keys.aiModel || 'openai/gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw await toAiError(res, 'openrouter');
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

// ──────────────────────────────────────────────────────────────────────────
// 에러 매핑
// ──────────────────────────────────────────────────────────────────────────

async function toAiError(res: Response, provider: ApiKeys['aiProvider']): Promise<AiError> {
  const text = await res.text().catch(() => '');
  let msg = text.slice(0, 500);
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string };
    const bodyErr = (body as { error?: { message?: string } })?.error;
    if (typeof bodyErr === 'string') msg = bodyErr;
    else if (bodyErr?.message) msg = bodyErr.message;
  } catch {
    /* keep raw text */
  }
  const status = res.status;
  if (status === 401 || status === 403) return new AiError('invalid_key', provider, msg, status);
  if (status === 429) return new AiError('rate_limit', provider, msg, status);
  if (status === 400 && /model|not_found|does not exist/i.test(msg))
    return new AiError('bad_model', provider, msg, status);
  if (/insufficient|credit|balance|quota|out of/i.test(msg))
    return new AiError('no_credit', provider, msg, status);
  return new AiError('generic', provider, `${status}: ${msg}`, status);
}

// ──────────────────────────────────────────────────────────────────────────
// 키 검증 — 각 제공자별 가장 저렴한 왕복
// ──────────────────────────────────────────────────────────────────────────

export async function verifyAiKey(keys: ApiKeys): Promise<{ ok: boolean; error?: string }> {
  if (!keys.aiKey) return { ok: false, error: 'Key missing' };
  try {
    switch (keys.aiProvider) {
      case 'openai': {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${keys.aiKey}` },
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: await readErr(r) };
      }
      case 'gemini': {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keys.aiKey)}`,
        );
        if (r.ok) return { ok: true };
        return { ok: false, error: await readErr(r) };
      }
      case 'claude': {
        // Anthropic엔 가벼운 검증 엔드포인트가 없어 최소 1 토큰 호출.
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': keys.aiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: keys.aiModel || 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: await readErr(r) };
      }
      case 'openrouter': {
        const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${keys.aiKey}` },
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: await readErr(r) };
      }
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function readErr(r: Response): Promise<string> {
  try {
    const body = (await r.json()) as { error?: { message?: string } | string };
    const bodyErr = (body as { error?: { message?: string } })?.error;
    if (typeof bodyErr === 'string') return bodyErr;
    if (bodyErr?.message) return bodyErr.message;
  } catch {
    /* ignore */
  }
  return `HTTP ${r.status}`;
}
