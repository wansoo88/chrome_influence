# HANDOFF — CreatorRadar 세션 핸드오프

> **다음 세션 시작 시 가장 먼저 이 문서를 읽으세요.** Claude Code가 자동으로 `CLAUDE.md`를 로드하지만, 사람이 읽기엔 이 파일이 더 빠릅니다.
>
> **권장 세션 시작 방법**: `D:\cashflow\creator-radar`를 cwd로 세팅한 뒤 `claude` 실행. 1차 프로젝트(X Reply Booster)의 컨텍스트·memory·hook이 섞이지 않도록 반드시 이 폴더 루트에서 시작.

---

## 제품 한 줄
크리에이터가 **매일 아침 여는** Chrome 확장. 자기 분야 Top 30 YouTube 크리에이터를 키워드로 자동 발굴 → 지난 7일 영상을 BYOK AI가 5문장 요약 + 3~5 클러스터 + Gap 배지로 정리 → Notion/Excel/Gmail/Markdown 내보내기.

- **가격**: 평생 $29 (다중 플랫폼 $49 애드온은 차기)
- **타겟**: 크리에이터 본인 (자기 분야 경쟁자·트렌드 모니터링)
- **BYOK**: 서버 0 · 유저 자기 API 키만 사용 · 프라이버시 우위
- **완전 독립**: 1차 프로젝트 X Reply Booster(`D:\cashflow\chrome`, `wansoo88/chrome`)와 코드·레포·storage 네임스페이스·Chrome 확장 ID 모두 분리

## 저장소
- **로컬**: `D:\cashflow\creator-radar\`
- **원격**: `https://github.com/wansoo88/chrome_influence.git`
- **브랜치**: `main`

---

## ✅ 지금까지 작성한 것 (2026-04-24 기준 누적)

### Week 1 스캐폴드 + 핵심 파이프라인 완성
커밋 `43c0593` — MVP 1차:
- Vite + React + TypeScript + CRXJS 스캐폴드 (독립 package.json · node_modules)
- Manifest V3 · chrome_url_overrides.newtab (새 탭을 대시보드로 대체)
- permissions: storage · unlimitedStorage · alarms (host_permissions 비어있음)
- `src/shared/` — types · storage(네임스페이스 `cr.state`) · i18n · messages · 20개 카테고리 프리셋 + 한국어 키워드 오버라이드
- `src/background/` — YouTube Data API 클라이언트 · AI 클러스터링 · 메시지 라우팅 · chrome.alarms 매일 아침 자동 갱신 · AbortController 요청 취소
- `src/newtab/Dashboard` — 3 패널 (Watchlist · Today's Brief · Actions) · 썸네일 그리드 · Gap 배지 · 다크 모드 자동
- `src/newtab/exporters` — Markdown 클립보드 / CSV 다운로드 / Gmail mailto / Notion-ready Markdown
- `src/options/OptionsApp` — 키 2개 입력 · 카테고리 프리셋 Grid · 언어 토글(en/ko) · DEV 토글 (env.DEV 가드)
- `src/popup/PopupApp` — 활성 카테고리 + 최신 클러스터 3개 + "Open Dashboard"

### AI 제공자 4종 + 프롬프트 대폭 개선
커밋 `b7af9a6` — Provider 확장:
- **AiProvider = 'openai' | 'gemini' | 'claude' | 'openrouter'** (4종)
- `src/shared/ai-providers.ts`: 제공자별 메타(문서 URL, 키 prefix, costHint, 추천 모델 5개, JSON 모드 지원 여부, Claude 경고)
- `src/background/ai.ts` 전면 개편: 4개 호출 함수 + 통합 라우팅 + 에러 매핑(invalid_key/rate_limit/no_credit/bad_model)
- `src/background/prompts.ts` **신규 모듈** — 프롬프트 엔지니어링 전용. ROLE/INPUTS/OUTPUT FORMAT/SUMMARY STRUCTURE/CLUSTER RULES/GAP DETECTION/LANGUAGE RULES/QUALITY CHECKLIST 8섹션 구조화. GOOD/BAD 예시 병기.
- `src/shared/storage.ts`: 기본값 확인
- Options UI: 4 provider chip · Claude 경고 박스 · 모델 **드롭다운(★ 추천) + "Custom model ID…"** · 동적 cost hint · provider 전환 시 기본 모델 자동 스왑

### 빌드 검증
- `pnpm build` 990ms 통과 (51 modules transformed)
- 번들 크기: newtab 12KB/4.5KB gzip · options 15KB/5.7KB gzip · popup 9.5KB/3.2KB gzip · background 17KB/6.4KB gzip · React client 142KB/45.7KB gzip

---

## ❌ 아직 안 한 것 (우선순위 순)

### 🥇 최우선 — 다음 세션 첫 할 일
1. **실 브라우저 테스트** (본인 키 꽂고 동작 검증 — 이게 없으면 나머지 무의미)
   - Google Cloud Console에서 YouTube Data API v3 키 발급 (5분, 무료)
   - OpenAI / Gemini / Claude / OpenRouter 중 하나 키 발급
   - `pnpm build` → `chrome://extensions` → 개발자 모드 → "압축해제된 확장 로드" → `dist/` 선택
   - 새 탭 열기 → Options로 이동 → 키 2개 Verify
   - 카테고리 프리셋 하나 선택 → Discover more 클릭 → Watchlist 채워지는지 확인
   - Refresh brief 클릭 → 5문장 summary + 3~5 클러스터 나오는지
   - 내보내기 4종 모두 테스트 (Markdown/CSV/Gmail/Notion)
2. **발견한 버그 수정** — 첫 실행에서 반드시 문제 나옴 (DOM·쿼터·응답 파싱 등)

### 🥈 프롬프트 품질 개선 — 사용자가 "프롬프트 몰두" 요청한 영역
실 출력을 몇 번 뽑아본 뒤 아래 순서로 반복:
3. **Few-shot 예시 삽입** — 클러스터 잘 된 출력 1~2개를 system prompt에 붙임 (`prompts.ts` 개선)
4. **카테고리별 도메인 어휘 힌트** — 피트니스는 "HIIT/풀업/고중량" 같은 어휘 인식 강화
5. **JSON parse 실패 시 재프롬프트** — "return stricter JSON" 1회 재시도
6. **내 채널 연결** — Options에 "내 YouTube 채널 ID" 입력 필드 추가 → 최근 영상 제목 자동 fetch → `myRecentTitles` 프롬프트 주입 → **Gap Report가 실제로 작동**

### 🥉 S 단계 (Week 2~3)
7. **Instagram 통합** — Graph API Business Discovery (사용자 OAuth) 또는 Xpoz BYOK
8. **X 통합** — Xpoz BYOK (`$100/월 공식은 부적합`)
9. **크로스 플랫폼 인물 병합** — 동일 핸들·이름 매칭
10. **My Performance 탭** — 내 영상 성과 vs Top 3 평균 시계열 비교
11. **데스크톱 알림** — Watchlist 급상승 크리에이터 감지

### L 단계 (출시 후)
12. **ExtensionPay 실연결** — Stub → ExtPayGateway 교체 (계정 등록 필요)
13. **TikTok** — 3자 API BYOK ($49 애드온)
14. **Twitch/Threads** — 공식 API 활용

### 스토어 제출 자산 (MVP 완성 후)
15. 아이콘 디자인 교체 (현재 에메랄드 그린 #10B981 플레이스홀더)
16. 스크린샷 5장 (1280×800)
17. 프로모 이미지 440×280
18. 개인정보 처리방침 정적 페이지 (Vercel/Cloudflare Pages)
19. Chrome Web Store 개발자 등록 ($5 일회성)
20. 스토어 제출

---

## ⚠️ 중요 컨텍스트 (다음 Claude가 알아야 할 것)

### 사용자 프로파일
- 크롬 확장 개발 경험 **없음** · AI 바이브코딩 전적 의존
- 주 20시간 이상 가용 (본업 수준)
- 글로벌 · 영어 중심 타겟 + 다국어 확장 의지
- 박리다매 $2~49 구간 선호 (구독보다 일회성)
- **복잡 의사결정 시 5 객관식 + 1 주관식으로 인터뷰** (글로벌 규칙)
- 응답은 항상 **한국어**로 작성

### 1차 프로젝트와의 완전 분리 원칙 (❗ 위반 금지)
- 1차(X Reply Booster, `D:\cashflow\chrome`, `wansoo88/chrome`)와 **코드·레포·패키지·storage 네임스페이스·Chrome 확장 ID 모두 별개**
- monorepo · npm/pnpm workspace · git submodule · 상대경로 import `../chrome/...` **모두 금지**
- 1차 코드에서 배운 설계 패턴을 **수동 복사해 독립 커밋**은 OK
- 1차 memory (`~/.claude/projects/D--cashflow-chrome/memory/`)는 이 프로젝트와 **별개** — 이 프로젝트는 `~/.claude/projects/D--cashflow-creator-radar/memory/` 사용
- chrome.storage 네임스페이스: 1차 `xrb.state` / 2차 `cr.state`

### 기술 결정 (변경 시 이 문서 업데이트)
| 항목 | 결정 |
|---|---|
| 빌드 | Vite + @crxjs/vite-plugin |
| 언어 | TypeScript strict |
| UI | React 18 · popup/options/newtab 3개 엔트리 |
| 상태 | chrome.storage.local (네임스페이스 `cr.state`) |
| AI 제공자 | OpenAI · Gemini · Claude · OpenRouter 4종 |
| AI 호출 | 전부 사용자 BYOK · background service worker에서만 fetch |
| 프롬프트 | `src/background/prompts.ts` 전용 모듈 |
| YouTube | 공식 Data API v3 무료 티어 (사용자 BYOK) |
| 내보내기 | Markdown · CSV · Gmail · Notion (OAuth 없이 복사/다운로드) |
| 결제 | ExtensionPay 예정 (아직 stub) |

### 아키텍처 레이어
```
background/ (SW)
├── index.ts          메시지 라우팅 · alarms · AbortController
├── youtube.ts        Data API 클라이언트 (BYOK)
├── ai.ts             4 제공자 호출 통합
└── prompts.ts        프롬프트 엔지니어링 (단독 반복)

shared/
├── types.ts          도메인 타입
├── storage.ts        cr.state 래퍼
├── messages.ts       UI↔BG 프로토콜
├── ai-providers.ts   4 제공자 메타
├── presets.ts        20개 카테고리 프리셋
├── i18n.ts · locales/en.ts
└── id.ts

newtab/     대시보드 (하루 3회+ 열림 가정)
options/    설정 (키 · 카테고리 · 언어 · DEV 토글)
popup/      스냅샷 + CTA
```

## 현재 리스크 (의식하고 결정할 것)

이 프로젝트는 **1차 프로젝트 완성 전**에 사용자 선택으로 조기 착수됐습니다. 리스크:
- 1차가 방치될 가능성 (실 브라우저 테스트·스토어 제출 미완료)
- 인터뷰 0명 상태의 가정 기반 개발 → 일부 기능 버려질 수 있음
- Kaito/VidIQ/Infloq/Favikon 등 경쟁 이미 존재 → 차별화 검증 필요

리서치 계획·인터뷰·경쟁 분석은 `D:\cashflow\creator-radar-research\docs\`에 저장됨 (이 폴더 외부). 인터뷰 결과가 나오면 `03-product-spec.md`의 "7. 실증 업데이트" 섹션 채우고 이 HANDOFF도 업데이트.

---

## 🔧 새 세션 시작 체크리스트

다음 세션에서 Claude가 첫 메시지에 수행하면 좋은 것:

1. 이 `HANDOFF.md` 읽고 이해 ✓
2. `CLAUDE.md` 읽고 원칙 수용 ✓
3. `git log --oneline` 으로 최근 커밋 확인
4. `git status` 로 미커밋 변경 없는지 확인
5. 사용자에게 "[ ] 실 브라우저 테스트 · [ ] 프롬프트 개선 · [ ] S 단계 기능 추가 · [ ] 기타" 중 뭐부터 할지 확인
6. 선택된 작업 TaskCreate로 등록 후 진행

**hook 주의**: `.claude/settings.local.json`이 존재하면 `git commit` 직후 `git push`가 자동 실행됩니다. 세션 시작 후 첫 커밋부터 적용됩니다.

---

## 📎 관련 경로 요약

| 목적 | 경로 |
|---|---|
| 제품 코드 (이 레포) | `D:\cashflow\creator-radar\` |
| 리서치·스펙 문서 | `D:\cashflow\creator-radar-research\docs\` |
| 크립토 특화 참조 | `D:\cashflow\crypto-canvas-research\` |
| 1차 프로젝트 (분리) | `D:\cashflow\chrome\` |
| 글로벌 Claude 규칙 | `C:\Users\kimws\.claude\CLAUDE.md` |
| 이 프로젝트 memory | `~/.claude/projects/D--cashflow-creator-radar/memory/` |

**마지막 업데이트**: 2026-04-24
**마지막 커밋**: `b7af9a6` (feat: AI 제공자 4종 + 프롬프트 개선)
