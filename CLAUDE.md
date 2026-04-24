# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **⚠️ 시작 시 먼저 읽을 것**: 코드 변경 전에 `HANDOFF.md`를 읽어 프로젝트 현재 상태·남은 일·사용자 컨텍스트를 파악하세요.

---

## 프로젝트 정체성

**제품명**: CreatorRadar — Daily Niche Brief
**한 줄 요약**: 크리에이터가 매일 아침 여는 Chrome 확장. 내 분야 Top N 크리에이터를 YouTube/IG/X에서 자동 발굴 → AI 클러스터·요약·갭 리포트 → Notion/Excel/Gmail 내보내기. BYOK · 평생 $29.
**타겟**: 크리에이터 본인 (자기 분야 경쟁자·트렌드 모니터링)
**수익 모델**: 평생 $29 박리다매 + 평생 $49 다중 플랫폼 애드온 (차기)
**원격**: `https://github.com/wansoo88/chrome_influence.git` (브랜치 `main`)

## 완전 분리 원칙 (❗ 위반 금지)

이 프로젝트는 **1차 프로젝트 X Reply Booster** (`D:\cashflow\chrome`, `wansoo88/chrome`)와 **완전히 독립된 제품**입니다. 사용자 지시 (2026-04-24): *"이건 다른 프로젝트이기 때문에 아예 폴더 및 소스구조를 분리해야 합니다."*

### 금지
- ❌ monorepo · npm/pnpm workspace · git submodule · 상대경로 import (`../chrome/...`)
- ❌ 1차 프로젝트의 chrome.storage 데이터 직접 읽기
- ❌ 1차의 Persona 데이터 자동 sync (수동 JSON export/import만 UX 편의로 허용)
- ❌ 동일 Chrome 확장 ID · 동일 storage 네임스페이스

### 허용
- ✅ 1차 프로젝트의 설계 패턴·코드를 **읽고 학습** → 이 레포에 **수동 복사 후 독립 커밋**
- ✅ 유저 데이터 이식성 (양쪽에서 Persona JSON export/import 포맷 동일하게 유지)

### 네임스페이스
| 항목 | 1차 | 2차 (이 프로젝트) |
|---|---|---|
| chrome.storage 키 | `xrb.state` | **`cr.state`** |
| Chrome 확장 ID | 별개 | 별개 |
| ExtensionPay 제품 ID | 별개 | 별개 (아직 미등록) |

## 핵심 의사결정 (변경 시 이 파일 + HANDOFF.md 업데이트)

| 항목 | 결정 | 이유 |
|---|---|---|
| 번들/빌드 | **Vite + @crxjs/vite-plugin** | MV3 + HMR 지원 |
| 언어 | **TypeScript strict** | 바이브코딩 정확도 향상 |
| UI | **React 18** (popup/options/newtab 3 엔트리) | AI 생성 친화 |
| 상태 | `chrome.storage.local` (네임스페이스 `cr.state`) | 서버 없음 |
| AI 제공자 | **OpenAI · Gemini · Claude · OpenRouter** 4종 | 유저 선택권 |
| AI 호출 | 사용자 BYOK, background service worker에서만 fetch | 프라이버시 · 보안 |
| 프롬프트 | `src/background/prompts.ts` 전용 모듈 | **"프롬프트 엔지니어링 몰두" 사용자 방침** |
| YouTube | 공식 Data API v3 (사용자 BYOK) | 무료 티어 10k units/일 |
| 결제 | **ExtensionPay** 예정 (현재 stub) | 서버 없음, 5% 수수료 |
| 타입 검사 | `tsc --noEmit && vite build` | 에러 0 유지 |
| 원격 푸시 | `git commit` 후 자동 `git push` hook | 사용자 지시 |

## 아키텍처 (읽어두면 시간 절약)

```
src/
├── manifest.config.ts              MV3 선언. chrome_url_overrides.newtab
├── shared/                         UI↔BG 공통
│   ├── types.ts                    도메인 타입
│   ├── storage.ts                  cr.state 래퍼 (getState/updateState/etc)
│   ├── messages.ts                 ClientMsg/ServerMsg 프로토콜
│   ├── ai-providers.ts             4 제공자 메타 + 모델 리스트
│   ├── presets.ts                  20개 카테고리 프리셋 + KO 오버라이드
│   ├── i18n.ts + locales/en.ts     사용자향 문자열 단일 사전
│   └── id.ts                       uid()
├── background/                     Service Worker
│   ├── index.ts                    메시지 라우팅 · chrome.alarms · AbortController
│   ├── youtube.ts                  Data API 클라이언트 (search/channels/playlistItems/videos)
│   ├── ai.ts                       4 제공자 호출 통합 · verifyAiKey · AiError
│   └── prompts.ts                  **프롬프트 엔지니어링 전용 — 단독 반복 대상**
├── newtab/                         브라우저 새 탭 = 대시보드
│   ├── Dashboard.tsx               3 패널 (Watchlist · Brief · Actions)
│   ├── exporters.ts                Markdown/CSV/Gmail/Notion
│   └── newtab.css
├── options/                        설정 페이지
│   ├── OptionsApp.tsx              키 2개 · 카테고리 · 언어 · DEV 토글
│   └── options.css
└── popup/                          툴바 팝업
    ├── PopupApp.tsx
    └── popup.css
```

### 메시지 흐름
1. UI가 `chrome.runtime.sendMessage({ kind: 'discoverCreators' | 'generateBrief' | 'verifyKey' | 'ping' })` 전송
2. `background/index.ts`의 단일 `onMessage` 리스너가 switch로 분기
3. discoverCreators → `youtube.searchCreatorsByKeywords` + storage 병합
4. generateBrief → `youtube.hydrateChannels` + `fetchRecentVideos` → `ai.summarizeAndCluster` (4 제공자 중 활성 것)
5. 응답은 `ServerMsg` discriminated union (`generateOk` / `briefOk` / `verifyOk` / `error`)
6. 에러 코드별(YT_QUOTA_EXCEEDED / AI_KEY_INVALID / etc) UI 매핑

### 매일 사용 루프
- `chrome.alarms` (`cr-daily-refresh`)가 매일 설정 시간(기본 09:00)에 발화
- 자동으로 `discoverCreators` → `generateBrief(forceRefresh=true)` 실행
- 사용자가 새 탭을 열면 이미 캐시된 brief 즉시 표시
- 설정 변경 시 `scheduleDailyAlarm`이 재예약

## 개발 워크플로우 (바이브코딩 전제)

**원칙**: 작은 루프 (한 기능·한 파일·한 빌드 검증). 큰 리팩터링은 사용자 확인 후.

- **매 변경 후** `pnpm build` 로 타입·빌드 모두 통과 유지 (에러 0)
- **매 커밋** 의미 있는 단위로 (feat: · fix: · refactor: · chore: · docs:)
- **hook 자동 푸시**: 커밋 직후 `origin/main`으로 자동 push (`.claude/hooks/auto-push.sh`)
- **실 브라우저 검증 우선**: 코드 쌓기보다 한 번 로드해 동작 확인이 항상 더 중요
- **프롬프트 변경**: `src/background/prompts.ts`만 수정하면 4 제공자 모두 자동 반영 — 반복 실험 쉬움

## Commands

```bash
# 의존성
pnpm install                  # 한 번만

# 개발
pnpm dev                      # Vite dev server + HMR
pnpm build                    # tsc --noEmit + vite build → dist/
pnpm lint:types               # 타입 체크만

# 로컬 Chrome 로드
# 1. pnpm build
# 2. chrome://extensions → 개발자 모드 ON
# 3. "압축해제된 확장 프로그램 로드" → dist/ 선택
# 4. 새 탭 열기 → 대시보드 표시됨
# 5. Options 에서 YouTube + AI 키 입력 후 Verify

# Git (커밋 후 자동 push — hook 적용 시)
git add -u
git commit -m "feat: ..."
# (자동 push됨)

# 아이콘 재생성 (플레이스홀더)
node scripts/make-placeholder-icons.mjs
```

## 절대 금지 사항 (프로젝트 고유)

- ❌ 사용자 API 키를 우리 서버·외부 로그·3자 분석 도구로 전송 — BYOK의 생명이 프라이버시
- ❌ `host_permissions`를 `<all_urls>`로 넓히기 — 현재 비어있음, 유지
- ❌ content script 추가 — 우리는 대시보드·Popup·Options만 (UI 표면 최소)
- ❌ 매뉴얼 설치 가이드 없이 새 provider 추가 — `ai-providers.ts` + `ai.ts` + 모델 리스트 동시 업데이트
- ❌ 프롬프트 변경 시 프롬프트 파일 외부에 하드코딩 — **모든 프롬프트는 `prompts.ts`로 수렴**

## 문서 인덱스 (이 순서로)

1. `HANDOFF.md` — 지금까지 한 것 · 다음 할 일 · 사용자 컨텍스트
2. `CLAUDE.md` (이 파일) — 원칙 · 아키텍처 · 명령어
3. `D:\cashflow\creator-radar-research\docs\` — 스펙·경쟁·인터뷰·데이터 전략 (읽어두면 결정 빠름)

## 세션 시작 루틴 (Claude Code용)

새 세션 시작 시 순서:
1. `HANDOFF.md` 읽기 (프로젝트 현재 상태)
2. `CLAUDE.md` (이 파일) 읽기 (원칙)
3. `git log --oneline -5` · `git status` 로 최근 상태
4. 사용자에게 "다음 할 일은 HANDOFF.md의 [1. 실 브라우저 테스트 / 2. 프롬프트 개선 / 3. S 기능 추가] 중 어떤 거 하시겠어요?"
5. 선택 후 작은 Task 묶음으로 TaskCreate

## 커뮤니케이션 규칙 (글로벌 + 이 프로젝트 강화)

- 응답은 한국어
- 코드 변경 전 계획 먼저 짧게 설명
- 불확실하면 질문 (5 객관식 + 1 주관식 규칙 복합 의사결정 시)
- any 타입 금지
- console.log 프로덕션 잔류 금지 (`import.meta.env.DEV` 가드)
- 주석은 WHY 중심
