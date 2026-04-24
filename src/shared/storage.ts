import type { ApiKeys, NicheCategory, StorageSchema } from './types';

/**
 * chrome.storage.local 단일-진입 래퍼.
 *
 * 1차 프로젝트(X Reply Booster)와 독립된 네임스페이스: `cr.state`.
 * 동일 브라우저에 두 확장이 설치되어도 storage는 extension ID로 격리되므로 기술적으로는
 * 충돌 없지만, 키 접두사를 다르게 해서 디버깅 시 혼동 방지.
 *
 * TODO(schema v2+): mergeState에서 migrate() 분기 추가.
 */

const ROOT_KEY = 'cr.state';
const SCHEMA_VERSION = 1;

const DEFAULT_API_KEYS: ApiKeys = {
  youtube: null,
  youtubeVerifiedAt: null,
  aiProvider: 'openai',
  aiKey: null,
  aiModel: 'gpt-4o-mini',
  aiVerifiedAt: null,
  xpoz: null,
};

function defaultState(): StorageSchema {
  return {
    version: SCHEMA_VERSION,
    apiKeys: { ...DEFAULT_API_KEYS },
    categories: [],
    watchlist: [],
    videoCache: [],
    briefs: [],
    license: { paid: false, purchasedAt: null, addonMultiPlatform: false },
    settings: {
      activeCategoryId: null,
      autoRefreshHour: 9,
      language: 'en',
    },
  };
}

function mergeState(raw: Partial<StorageSchema>): StorageSchema {
  return {
    version: raw.version ?? SCHEMA_VERSION,
    apiKeys: { ...DEFAULT_API_KEYS, ...(raw.apiKeys ?? {}) },
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist : [],
    videoCache: Array.isArray(raw.videoCache) ? raw.videoCache : [],
    briefs: Array.isArray(raw.briefs) ? raw.briefs : [],
    license: {
      paid: false,
      purchasedAt: null,
      addonMultiPlatform: false,
      ...(raw.license ?? {}),
    },
    settings: {
      activeCategoryId: null,
      autoRefreshHour: 9,
      language: 'en',
      ...(raw.settings ?? {}),
    },
  };
}

export async function getState(): Promise<StorageSchema> {
  const row = await chrome.storage.local.get(ROOT_KEY);
  const raw = row[ROOT_KEY] as Partial<StorageSchema> | undefined;
  if (!raw) return defaultState();
  return mergeState(raw);
}

export async function updateState(
  mutator: (s: StorageSchema) => StorageSchema | void,
): Promise<StorageSchema> {
  const current = await getState();
  const draft: StorageSchema = structuredClone(current);
  const result = mutator(draft);
  const next = result ?? draft;
  await chrome.storage.local.set({ [ROOT_KEY]: next });
  return next;
}

export async function getApiKeys(): Promise<ApiKeys> {
  const s = await getState();
  return s.apiKeys;
}

export async function setApiKeys(patch: Partial<ApiKeys>): Promise<void> {
  await updateState((s) => {
    s.apiKeys = { ...s.apiKeys, ...patch };
  });
}

export async function saveCategory(cat: NicheCategory): Promise<void> {
  await updateState((s) => {
    const idx = s.categories.findIndex((c) => c.id === cat.id);
    if (idx === -1) s.categories.push(cat);
    else s.categories[idx] = cat;
    if (!s.settings.activeCategoryId) s.settings.activeCategoryId = cat.id;
  });
}

export async function setActiveCategory(id: string | null): Promise<void> {
  await updateState((s) => {
    s.settings.activeCategoryId = id;
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await updateState((s) => {
    s.categories = s.categories.filter((c) => c.id !== id);
    if (s.settings.activeCategoryId === id) {
      s.settings.activeCategoryId = s.categories[0]?.id ?? null;
    }
  });
}

export function onStateChanged(
  listener: (next: StorageSchema | null) => void,
): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area !== 'local') return;
    if (!changes[ROOT_KEY]) return;
    const next = changes[ROOT_KEY].newValue as StorageSchema | undefined;
    listener(next ?? null);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export const CONSTANTS = {
  ROOT_KEY,
  SCHEMA_VERSION,
} as const;
