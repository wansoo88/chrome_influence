import { useEffect, useState } from 'react';
import {
  getState,
  onStateChanged,
  saveCategory,
  setActiveCategory,
  setApiKeys,
  updateState,
} from '@/shared/storage';
import type { ApiKeys, NicheCategory, StorageSchema } from '@/shared/types';
import { CATEGORY_PRESETS, CATEGORY_KEYWORDS_KO } from '@/shared/presets';
import type { ServerMsg, VerifyKeyRequest } from '@/shared/messages';
import { uid } from '@/shared/id';
import { PROVIDERS, getDefaultModelFor } from '@/shared/ai-providers';
import type { AiProvider } from '@/shared/types';

/**
 * Options:
 * - API 키 2개 (YouTube Data API + AI 제공자)
 * - 카테고리 선택 (프리셋 20개 + 커스텀)
 * - 언어·지역·자동 갱신 시간
 * - 라이선스 (DEV 토글은 import.meta.env.DEV 가드)
 */

export function OptionsApp() {
  const [state, setState] = useState<StorageSchema | null>(null);

  useEffect(() => {
    let active = true;
    void getState().then((s) => {
      if (active) setState(s);
    });
    const unsub = onStateChanged((next) => {
      if (next) setState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (!state) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <h1>🎯 CreatorRadar</h1>
      <div className="muted">
        Daily brief of what top creators in your niche just published. Pay once $29. Bring your own
        keys — nothing leaves your browser except direct API calls to Google &amp; your AI provider.
      </div>

      <h2>1. API keys</h2>
      <KeysSection keys={state.apiKeys} />

      <h2>2. Niche category</h2>
      <CategorySection state={state} />

      <h2>3. Preferences</h2>
      <PreferencesSection state={state} />

      <h2>4. License</h2>
      <LicenseSection state={state} />

      <h2>Privacy</h2>
      <div className="card muted" style={{ fontSize: 13 }}>
        All API keys and settings live in <code>chrome.storage.local</code> on this device only.
        YouTube and AI calls go straight from your browser to Google / OpenAI / OpenRouter. The
        developer's servers are never involved.
        <div style={{ marginTop: 8 }}>
          <b>Heads up:</b> if you record Network activity in DevTools, your keys appear in request
          headers. Redact before sharing bug reports.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Keys
// ──────────────────────────────────────────────────────────────────────────

function KeysSection({ keys }: { keys: ApiKeys }) {
  const [ytKey, setYtKey] = useState(keys.youtube ?? '');
  const [aiKey, setAiKey] = useState(keys.aiKey ?? '');
  const [aiProvider, setAiProvider] = useState<AiProvider>(keys.aiProvider);
  const [aiModel, setAiModel] = useState(keys.aiModel);
  // provider 전환 시 모델이 다른 제공자의 기본값이면 자동 교체.
  useEffect(() => {
    const allKnownDefaults = (Object.keys(PROVIDERS) as AiProvider[]).map(getDefaultModelFor);
    setAiModel((prev) => (!prev || allKnownDefaults.includes(prev) ? getDefaultModelFor(aiProvider) : prev));
  }, [aiProvider]);
  const [ytMsg, setYtMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ytVerifying, setYtVerifying] = useState(false);
  const [aiVerifying, setAiVerifying] = useState(false);

  async function verifyYt() {
    setYtVerifying(true);
    setYtMsg(null);
    await setApiKeys({ youtube: ytKey.trim() });
    const req: VerifyKeyRequest = { kind: 'verifyKey', target: 'youtube', keys: { youtube: ytKey.trim() } };
    try {
      const res = (await chrome.runtime.sendMessage(req)) as ServerMsg | undefined;
      if (res?.ok && res.kind === 'verifyOk') {
        await setApiKeys({ youtube: ytKey.trim(), youtubeVerifiedAt: Date.now() });
        setYtMsg({ ok: true, text: 'YouTube key verified. You can discover creators now.' });
      } else if (res && res.ok === false) {
        setYtMsg({ ok: false, text: res.message });
      } else {
        setYtMsg({ ok: false, text: 'Unexpected response.' });
      }
    } catch (e) {
      setYtMsg({ ok: false, text: (e as Error).message });
    } finally {
      setYtVerifying(false);
    }
  }

  async function verifyAi() {
    setAiVerifying(true);
    setAiMsg(null);
    const modelToSave = aiModel.trim() || getDefaultModelFor(aiProvider);
    await setApiKeys({ aiKey: aiKey.trim(), aiProvider, aiModel: modelToSave });
    const req: VerifyKeyRequest = {
      kind: 'verifyKey',
      target: 'ai',
      keys: { aiKey: aiKey.trim(), aiProvider, aiModel: modelToSave },
    };
    try {
      const res = (await chrome.runtime.sendMessage(req)) as ServerMsg | undefined;
      if (res?.ok && res.kind === 'verifyOk') {
        await setApiKeys({ aiVerifiedAt: Date.now() });
        setAiMsg({ ok: true, text: 'AI key verified.' });
      } else if (res && res.ok === false) {
        setAiMsg({ ok: false, text: res.message });
      } else {
        setAiMsg({ ok: false, text: 'Unexpected response.' });
      }
    } catch (e) {
      setAiMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAiVerifying(false);
    }
  }

  const providerMeta = PROVIDERS[aiProvider];
  const isCustomModel = !providerMeta.models.some((m) => m.id === aiModel);

  return (
    <div className="card">
      <div className="field">
        <label>YouTube Data API v3 key</label>
        <input
          type="password"
          name="cr-yt-key"
          value={ytKey}
          onChange={(e) => setYtKey(e.target.value)}
          placeholder="AIzaSy…"
          autoComplete="new-password"
          spellCheck={false}
        />
        <div className="hint">
          Get a free key:{' '}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Google Cloud Console
          </a>
          . Enable "YouTube Data API v3" for the project. Quota: 10,000 units/day free (~100 searches/day).
        </div>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn primary"
          onClick={() => void verifyYt()}
          disabled={!ytKey.trim() || ytVerifying}
        >
          {ytVerifying ? 'Verifying…' : 'Verify & save'}
        </button>
        {keys.youtubeVerifiedAt && (
          <span className="muted">Verified {new Date(keys.youtubeVerifiedAt).toLocaleString()}</span>
        )}
      </div>
      {ytMsg && (
        <div style={{ marginTop: 8 }}>
          <span className={ytMsg.ok ? 'ok' : 'err'}>{ytMsg.text}</span>
        </div>
      )}

      <div className="divider" />

      <div className="field">
        <label>AI provider</label>
        <div className="chips">
          {(Object.keys(PROVIDERS) as AiProvider[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${aiProvider === p ? 'active' : ''}`}
              onClick={() => setAiProvider(p)}
            >
              {PROVIDERS[p].label}
            </button>
          ))}
        </div>
        <div className="hint">{providerMeta.costHintPerBrief}</div>
      </div>

      {providerMeta.warning && (
        <div
          className="hint"
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--fg)',
            marginBottom: 12,
          }}
        >
          ⚠️ {providerMeta.warning}
        </div>
      )}

      <div className="field">
        <label>AI API key</label>
        <input
          type="password"
          name="cr-ai-key"
          value={aiKey}
          onChange={(e) => setAiKey(e.target.value)}
          placeholder={providerMeta.keyPrefix ? `${providerMeta.keyPrefix}…` : 'paste your key'}
          autoComplete="new-password"
          spellCheck={false}
        />
        <div className="hint">
          <a href={providerMeta.docUrl} target="_blank" rel="noreferrer">
            Get a {providerMeta.label} key
          </a>
          . Stored on this device only — never sent to the developer.
        </div>
      </div>

      <div className="field">
        <label>Model</label>
        <select
          value={isCustomModel ? '__custom__' : aiModel}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__custom__') {
              // 커스텀 입력으로 전환 — 값 비우지 않고 그대로 둔 채 input 노출.
              setAiModel('');
            } else {
              setAiModel(v);
            }
          }}
        >
          {providerMeta.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.recommended ? '★ ' : ''}
              {m.label}
              {m.note ? ` — ${m.note}` : ''}
            </option>
          ))}
          <option value="__custom__">Custom model ID…</option>
        </select>
        {isCustomModel && (
          <>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={getDefaultModelFor(aiProvider)}
              style={{ marginTop: 8 }}
            />
            <div className="hint">
              Enter any model ID the provider accepts. Example:{' '}
              <code>{getDefaultModelFor(aiProvider)}</code>.
            </div>
          </>
        )}
      </div>

      <div className="row">
        <button
          type="button"
          className="btn primary"
          onClick={() => void verifyAi()}
          disabled={!aiKey.trim() || aiVerifying}
        >
          {aiVerifying ? 'Verifying…' : 'Verify & save'}
        </button>
        {keys.aiVerifiedAt && (
          <span className="muted">Verified {new Date(keys.aiVerifiedAt).toLocaleString()}</span>
        )}
      </div>
      {aiMsg && (
        <div style={{ marginTop: 8 }}>
          <span className={aiMsg.ok ? 'ok' : 'err'}>{aiMsg.text}</span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Category
// ──────────────────────────────────────────────────────────────────────────

function CategorySection({ state }: { state: StorageSchema }) {
  const activeId = state.settings.activeCategoryId;
  const [language, setLanguage] = useState<'en' | 'ko'>(state.settings.language as 'en' | 'ko');

  async function pickPreset(
    preset: Omit<NicheCategory, 'id' | 'isPreset'>,
  ): Promise<void> {
    const keywords =
      language === 'ko' && CATEGORY_KEYWORDS_KO[preset.label]
        ? CATEGORY_KEYWORDS_KO[preset.label]!
        : preset.keywords;
    const cat: NicheCategory = {
      id: uid('cat'),
      label: preset.label,
      emoji: preset.emoji,
      isPreset: true,
      keywords,
      language: language === 'ko' ? 'ko' : preset.language,
      regionCode: language === 'ko' ? 'KR' : undefined,
    };
    await saveCategory(cat);
    await updateState((s) => {
      s.settings.language = language;
    });
  }

  return (
    <div className="card">
      <div className="field">
        <label>Language preference for keyword matching</label>
        <div className="chips">
          <button
            type="button"
            className={`chip ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button
            type="button"
            className={`chip ${language === 'ko' ? 'active' : ''}`}
            onClick={() => setLanguage('ko')}
          >
            한국어
          </button>
        </div>
        <div className="hint">
          Only affects default keywords for presets. You can always edit keywords per category.
        </div>
      </div>

      {state.categories.length > 0 && (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Your active categories ({state.categories.length})</label>
            <div className="chips">
              {state.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${c.id === activeId ? 'active' : ''}`}
                  onClick={() => void setActiveCategory(c.id)}
                  title={c.keywords.join(' · ')}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divider" />
        </>
      )}

      <div className="muted">Pick a preset to get started in 5 seconds:</div>
      <div className="preset-grid">
        {CATEGORY_PRESETS.map((p) => {
          const existing = state.categories.find((c) => c.isPreset && c.label === p.label);
          const isActive = existing?.id === activeId;
          return (
            <button
              key={p.label}
              type="button"
              className={`preset-card ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (existing) {
                  void setActiveCategory(existing.id);
                } else {
                  void pickPreset(p);
                }
              }}
            >
              <div className="emoji">{p.emoji}</div>
              <div className="label">{p.label}</div>
              <div className="keywords">
                {(language === 'ko' && CATEGORY_KEYWORDS_KO[p.label]
                  ? CATEGORY_KEYWORDS_KO[p.label]!
                  : p.keywords
                )
                  .slice(0, 3)
                  .join(' · ')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Preferences
// ──────────────────────────────────────────────────────────────────────────

function PreferencesSection({ state }: { state: StorageSchema }) {
  return (
    <div className="card">
      <div className="field">
        <label>Daily refresh time (local)</label>
        <select
          value={state.settings.autoRefreshHour}
          onChange={async (e) => {
            const hour = Number(e.target.value);
            await updateState((s) => {
              s.settings.autoRefreshHour = hour;
            });
          }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, '0')}:00
            </option>
          ))}
        </select>
        <div className="hint">
          Chrome alarms wakes the extension at this hour and pre-fetches the brief. You can still
          refresh manually from the new tab dashboard.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// License
// ──────────────────────────────────────────────────────────────────────────

function LicenseSection({ state }: { state: StorageSchema }) {
  return (
    <div className="card">
      {state.license.paid ? (
        <div>
          <div className="ok" style={{ fontWeight: 600 }}>Upgraded — thanks!</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Unlimited categories · All features.
          </div>
          {import.meta.env.DEV && (
            <div className="row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await updateState((s) => {
                    s.license.paid = false;
                    s.license.purchasedAt = null;
                  });
                }}
              >
                DEV: revert to free
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Upgrade — $29 once, forever</div>
          <ul className="muted" style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>Unlimited categories (free is 1)</li>
            <li>Gap reports + video cache up to 500 items</li>
            <li>All export formats (Notion, Excel, Gmail, Markdown)</li>
          </ul>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                // ExtensionPay 연결 시 이 버튼을 실제 결제 URL로 교체.
                alert('Payment integration pending. Developer account setup required.');
              }}
            >
              Upgrade (soon)
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await updateState((s) => {
                    s.license.paid = true;
                    s.license.purchasedAt = Date.now();
                  });
                }}
              >
                DEV: mark paid
              </button>
            )}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            Payments will be processed by ExtensionPay once the developer account is registered.
          </div>
        </div>
      )}
    </div>
  );
}
