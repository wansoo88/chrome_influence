import { useEffect, useMemo, useState } from 'react';
import { getState, onStateChanged } from '@/shared/storage';
import type { DailyBrief, NicheCategory, StorageSchema } from '@/shared/types';

/**
 * Popup — 작은 스냅샷. "지금 상태가 어떤지"와 "대시보드 열기" CTA.
 */

export function PopupApp() {
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

  if (!state) return <div className="container"><div className="muted">Loading…</div></div>;

  const setupComplete = Boolean(
    state.apiKeys.youtube && state.apiKeys.aiKey && activeCategory,
  );

  function openDashboard() {
    // 새 탭 = 대시보드. 이미 새 탭을 기본 대체했으므로 단순히 새 탭 열기.
    chrome.tabs.create({ url: 'chrome://newtab' }).catch(() => void 0);
  }

  return (
    <div className="container">
      <div className="title">
        <span>🎯</span>
        <span>CreatorRadar</span>
      </div>

      {!setupComplete && (
        <>
          <div className="muted">Finish setup to see your daily brief:</div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: 1.7 }}>
            <li style={{ textDecoration: state.apiKeys.youtube ? 'line-through' : 'none' }}>
              YouTube API key
            </li>
            <li style={{ textDecoration: state.apiKeys.aiKey ? 'line-through' : 'none' }}>
              AI provider key
            </li>
            <li style={{ textDecoration: activeCategory ? 'line-through' : 'none' }}>
              Niche category
            </li>
          </ul>
          <div className="row">
            <button
              type="button"
              className="btn primary grow"
              onClick={() => chrome.runtime.openOptionsPage?.()}
            >
              Open Settings →
            </button>
          </div>
        </>
      )}

      {setupComplete && activeCategory && (
        <>
          <div className="muted">Active category</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>
            {activeCategory.emoji} {activeCategory.label}
          </div>

          <div className="divider" />

          {activeBrief ? (
            <>
              <div className="muted">Latest clusters</div>
              <div style={{ marginTop: 6 }}>
                {activeBrief.clusters.slice(0, 3).map((c) => (
                  <div key={c.id} className="cluster-chip">
                    {c.isGap ? '🔥 ' : ''}
                    {c.label}
                  </div>
                ))}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                Updated {new Date(activeBrief.generatedAt).toLocaleString()}
              </div>
            </>
          ) : (
            <div className="muted">No brief yet. Open the dashboard to generate.</div>
          )}

          <div className="row">
            <button type="button" className="btn primary grow" onClick={openDashboard}>
              Open Dashboard →
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => chrome.runtime.openOptionsPage?.()}
            >
              Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
}
