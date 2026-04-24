import { useEffect, useMemo, useState } from 'react';
import { getState, onStateChanged, setActiveCategory } from '@/shared/storage';
import type { CreatorRef, DailyBrief, NicheCategory, StorageSchema, VideoMeta } from '@/shared/types';
import type { ServerMsg } from '@/shared/messages';
import { exportBrief, type ExportFormat } from './exporters';

/**
 * New Tab Dashboard — 3 패널 (Watchlist / Brief / Actions).
 */

export function Dashboard() {
  const [state, setState] = useState<StorageSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const activeCategory: NicheCategory | undefined = useMemo(
    () => state?.categories.find((c) => c.id === state.settings.activeCategoryId),
    [state],
  );

  const activeBrief: DailyBrief | undefined = useMemo(
    () =>
      activeCategory
        ? state?.briefs.find((b) => b.categoryId === activeCategory.id)
        : undefined,
    [state, activeCategory],
  );

  const videoIndex: Map<string, VideoMeta> = useMemo(() => {
    const m = new Map<string, VideoMeta>();
    if (state) for (const v of state.videoCache) m.set(v.platformId, v);
    return m;
  }, [state]);

  if (!state) return <div className="shell"><div className="muted">Loading…</div></div>;

  const setupComplete = Boolean(
    state.apiKeys.youtube && state.apiKeys.aiKey && activeCategory,
  );

  async function refresh() {
    if (!activeCategory) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await chrome.runtime.sendMessage({
        kind: 'generateBrief',
        categoryId: activeCategory.id,
        forceRefresh: true,
      })) as ServerMsg | undefined;
      if (res && res.ok === false) setError(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function discover() {
    if (!activeCategory) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await chrome.runtime.sendMessage({
        kind: 'discoverCreators',
        categoryId: activeCategory.id,
      })) as ServerMsg | undefined;
      if (res && res.ok === false) setError(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <Header
        categories={state.categories}
        activeId={state.settings.activeCategoryId}
        onPick={(id) => void setActiveCategory(id)}
        onOpenOptions={() => chrome.runtime.openOptionsPage?.()}
        onRefresh={refresh}
        onDiscover={discover}
        loading={loading}
        canAct={setupComplete}
      />

      {!setupComplete && <SetupNudge state={state} />}

      {setupComplete && (
        <div className="grid">
          <WatchlistPanel
            watchlist={state.watchlist}
            loading={loading}
            onDiscover={discover}
          />
          <BriefPanel
            brief={activeBrief}
            videoIndex={videoIndex}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
          <ActionsPanel
            brief={activeBrief}
            videoIndex={videoIndex}
            categoryLabel={activeCategory?.label ?? ''}
          />
        </div>
      )}
    </div>
  );
}

function Header({
  categories,
  activeId,
  onPick,
  onOpenOptions,
  onRefresh,
  onDiscover,
  loading,
  canAct,
}: {
  categories: NicheCategory[];
  activeId: string | null;
  onPick: (id: string) => void;
  onOpenOptions: () => void;
  onRefresh: () => void;
  onDiscover: () => void;
  loading: boolean;
  canAct: boolean;
}) {
  return (
    <div className="header">
      <div className="title">
        <span className="dot" />
        <span>CreatorRadar</span>
      </div>
      <div className="header-right">
        {categories.length > 0 && (
          <select
            className="category-selector"
            value={activeId ?? ''}
            onChange={(e) => onPick(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn"
          onClick={onDiscover}
          disabled={!canAct || loading}
          title="Find more top creators"
        >
          Discover more
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onRefresh}
          disabled={!canAct || loading}
        >
          {loading ? 'Loading…' : 'Refresh brief'}
        </button>
        <button type="button" className="btn" onClick={onOpenOptions}>
          Settings
        </button>
      </div>
    </div>
  );
}

function SetupNudge({ state }: { state: StorageSchema }) {
  const hasYt = Boolean(state.apiKeys.youtube);
  const hasAi = Boolean(state.apiKeys.aiKey);
  const hasCat = state.categories.length > 0;
  return (
    <div className="card">
      <div className="card-title">Welcome — 3 steps to go</div>
      <ol style={{ lineHeight: 1.8, paddingLeft: 20 }}>
        <li style={{ textDecoration: hasYt ? 'line-through' : 'none' }}>
          Add your <b>YouTube Data API key</b> in Settings
        </li>
        <li style={{ textDecoration: hasAi ? 'line-through' : 'none' }}>
          Add your <b>OpenAI or OpenRouter key</b>
        </li>
        <li style={{ textDecoration: hasCat ? 'line-through' : 'none' }}>
          Pick a <b>niche category</b> (20 presets, or custom keywords)
        </li>
      </ol>
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn primary"
          onClick={() => chrome.runtime.openOptionsPage?.()}
        >
          Open Settings →
        </button>
      </div>
    </div>
  );
}

function WatchlistPanel({
  watchlist,
  onDiscover,
  loading,
}: {
  watchlist: CreatorRef[];
  onDiscover: () => void;
  loading: boolean;
}) {
  return (
    <div className="card">
      <div className="card-title">Watchlist ({watchlist.length})</div>
      {watchlist.length === 0 ? (
        <div className="empty">
          <b>No creators yet.</b>
          <div>Click "Discover more" to auto-find top creators.</div>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 14 }}
            onClick={onDiscover}
            disabled={loading}
          >
            Discover now
          </button>
        </div>
      ) : (
        <div className="watchlist">
          {watchlist.map((c) => (
            <div key={`${c.platform}:${c.platformId}`} className="creator">
              <div className="avatar">
                {c.thumbnailUrl && <img src={c.thumbnailUrl} alt="" />}
              </div>
              <div className="name">{c.title}</div>
              {c.subscriberCount !== undefined && (
                <div className="count">
                  {Intl.NumberFormat('en', { notation: 'compact' }).format(c.subscriberCount)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefPanel({
  brief,
  videoIndex,
  loading,
  error,
  onRefresh,
}: {
  brief: DailyBrief | undefined;
  videoIndex: Map<string, VideoMeta>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="card">
      <div className="card-title">Today's Brief</div>
      {error && <div className="err">{error}</div>}
      {loading && !brief && (
        <div className="empty">
          <span className="spinner" />
          <div style={{ marginTop: 12 }}>Generating your daily brief…</div>
        </div>
      )}
      {!loading && !brief && !error && (
        <div className="empty">
          <b>No brief yet.</b>
          <div>Click "Refresh brief" to generate.</div>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 14 }}
            onClick={onRefresh}
          >
            Generate now
          </button>
        </div>
      )}
      {brief && (
        <>
          <div className="summary">{brief.summary}</div>
          <div className="muted" style={{ marginTop: 10 }}>
            Last updated {new Date(brief.generatedAt).toLocaleString()}
          </div>

          <div style={{ marginTop: 20 }}>
            {brief.clusters.map((c) => (
              <div key={c.id} className="cluster">
                <div className="cluster-head">
                  <div className="cluster-label">{c.label}</div>
                  {c.isGap && <span className="gap-badge">🔥 GAP</span>}
                </div>
                <div className="videos">
                  {c.videoIds.map((vid) => {
                    const v = videoIndex.get(vid);
                    if (!v) return null;
                    return (
                      <a
                        key={vid}
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="video"
                      >
                        <div className="thumb">
                          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" />}
                        </div>
                        <div className="meta">
                          <div className="t">{v.title}</div>
                          <div className="n">
                            {v.viewCount !== undefined &&
                              Intl.NumberFormat('en', { notation: 'compact' }).format(v.viewCount) +
                                ' views'}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionsPanel({
  brief,
  videoIndex,
  categoryLabel,
}: {
  brief: DailyBrief | undefined;
  videoIndex: Map<string, VideoMeta>;
  categoryLabel: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  async function doExport(format: ExportFormat) {
    if (!brief) return;
    setMsg(null);
    try {
      const out = await exportBrief({ brief, videoIndex, categoryLabel, format });
      if (out) setMsg(out);
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Actions</div>
      {!brief ? (
        <div className="muted">Generate a brief to enable exports.</div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            Export today's brief to your workflow:
          </div>
          <div className="export-row">
            <button type="button" className="btn export-btn" onClick={() => void doExport('markdown')}>
              📋 Copy as Markdown
            </button>
            <button type="button" className="btn export-btn" onClick={() => void doExport('csv')}>
              📊 Download as CSV (Excel / Sheets)
            </button>
            <button type="button" className="btn export-btn" onClick={() => void doExport('gmail')}>
              📧 Draft in Gmail
            </button>
            <button type="button" className="btn export-btn" onClick={() => void doExport('notion')}>
              📝 Copy Notion-ready markdown
            </button>
          </div>
          {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}
