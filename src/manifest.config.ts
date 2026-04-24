import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

/**
 * Manifest V3 정의.
 *
 * 1차 프로젝트(X Reply Booster)와 완전 독립 제품.
 * - 확장 ID · name · storage 네임스페이스 · ExtensionPay 제품 ID 모두 별개.
 * - content script 없음 — 새 탭 대시보드 + Popup + Options 구조.
 *
 * 권한 사유 (스토어 제출 시 Justification 필드 기입):
 * - storage: 로컬에 API 키·카테고리·Watchlist 저장
 * - unlimitedStorage: 영상 메타데이터 캐시 (수천 건 예상)
 * - alarms: 매일 아침 브리프 갱신 스케줄
 * - chrome_url_overrides.newtab: 브라우저 새 탭을 대시보드로 대체
 */
export default defineManifest({
  manifest_version: 3,
  name: 'CreatorRadar — Daily Niche Brief',
  version: pkg.version,
  description:
    'Auto-discover top creators in your niche. AI brief + gap report + export to Notion/Excel/Gmail. Pay once, bring your own key.',
  default_locale: 'en',

  icons: {
    '16': 'icons/16.png',
    '48': 'icons/48.png',
    '128': 'icons/128.png',
  },

  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'CreatorRadar',
    default_icon: {
      '16': 'icons/16.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
  },

  options_page: 'src/options/index.html',

  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // 외부 API 호출(YouTube Data API, OpenAI 등)은 background에서 fetch로 수행.
  // 특정 도메인 host_permissions는 일반적으로 불필요하나, YouTube 이미지 프리로드가
  // 필요해지면 여기 추가.
  host_permissions: [],

  permissions: ['storage', 'unlimitedStorage', 'alarms'],

  minimum_chrome_version: '99',
});
