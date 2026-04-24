import type { NicheCategory, VideoMeta } from '@/shared/types';

/**
 * 프롬프트 엔지니어링 모듈. ai.ts에서 분리해 "프롬프트 실험"을 자유롭게.
 *
 * 설계 원칙:
 * 1. 역할을 최상단에 명시 (ROLE)
 * 2. 입력 구조를 명확히 (INPUTS)
 * 3. 출력 JSON 스키마를 코드로 표시
 * 4. 규칙을 번호 매겨 구체적으로 (RULES)
 * 5. 좋은 예·나쁜 예 병기 (GOOD/BAD)
 * 6. Negative prompts로 흔한 실패 차단
 * 7. 언어 지시는 동적 (카테고리 language에 맞춤)
 *
 * 품질 목표:
 * - 클러스터 라벨이 "tips"/"review" 같은 일반어로 빠지지 않음
 * - 5문장 summary가 템플릿 순서(모멘텀→핫주제→특이점→관객반응→놓치지 말 것)
 * - isGap 판정이 표면 키워드 일치를 넘어 주제 유사도로 작동
 */

export interface BriefPromptInput {
  category: NicheCategory;
  videos: VideoMeta[];
  myRecentTitles?: string[];
}

export interface PromptPair {
  system: string;
  user: string;
}

/**
 * 메인 Daily Brief 프롬프트. 제목 + 조회수 + 발행일만 전달 (토큰 최적화).
 * description·댓글은 의도적 제외 (비용 90% 절감 + 노이즈 방지).
 */
export function buildBriefPrompt(input: BriefPromptInput): PromptPair {
  const { category, videos, myRecentTitles = [] } = input;

  const outputLang = describeLanguage(category.language);
  const hasMyTitles = myRecentTitles.length > 0;

  const system = [
    '# ROLE',
    'You are a senior content strategist helping a single creator research their niche.',
    'Your only job: turn raw YouTube metadata into a decision-ready brief the creator can read in 60 seconds and decide what to film this week.',
    '',
    '# INPUTS',
    `- CATEGORY: the creator's niche (label + keywords they care about)`,
    '- VIDEOS: recent videos (last 7 days) from top creators in this niche',
    '  Each item: videoId, title, viewCount, publishedAt',
    hasMyTitles
      ? `- MY_RECENT_TITLES: titles of the user's own recent videos, for gap detection`
      : '- MY_RECENT_TITLES: (not provided — isGap should always be false)',
    '- OUTPUT_LANGUAGE: language the SUMMARY must be written in',
    '',
    '# OUTPUT FORMAT (strict)',
    'Return ONLY valid JSON. No markdown fences, no prose, no trailing commas.',
    '{',
    '  "summary": "Five sentences, separated by spaces, in OUTPUT_LANGUAGE.",',
    '  "clusters": [',
    '    { "label": "Specific 2-5 word topic", "videoIds": ["id1","id2"], "isGap": false }',
    '  ]',
    '}',
    '',
    '# SUMMARY STRUCTURE (exactly 5 sentences, in this order)',
    '1. Overall momentum in this niche this week (is the space hot, cooling, steady).',
    '2. Single most-discussed topic or recurring angle (use the concrete topic name, not "tutorials").',
    '3. One surprising or unusual signal (an outlier view count, a new angle, a sudden uptick).',
    '4. Audience reaction cue if inferrable (high engagement on short-form vs long-form, a format winning).',
    '5. The ONE thing this creator should not miss this week (actionable, specific, in their voice direction).',
    '',
    '# CLUSTER RULES',
    '1. Produce 3 to 5 clusters. Return fewer only if topics are truly sparse. Never pad.',
    '2. Each video belongs to EXACTLY ONE cluster (no duplicate videoIds across clusters).',
    '3. Sort videoIds inside a cluster by viewCount descending.',
    '4. Label must be SPECIFIC and SEARCHABLE as a keyword. 2-5 words.',
    '   GOOD: "weighted vest training", "Notion AI database templates", "OpenAI Sora 2 first look"',
    '   BAD:  "workout tips", "AI tutorials", "general", "miscellaneous", "reviews"',
    '5. Merge near-duplicate topics into one cluster (same subject, different words).',
    '6. Skip a cluster if it would contain only one low-view video (<5% of the max view in this batch).',
    '',
    '# GAP DETECTION',
    hasMyTitles
      ? [
          '1. Mark isGap=true when the cluster topic is NOT semantically present in MY_RECENT_TITLES.',
          '2. "Semantically present" means the user covered the same underlying subject, even with different phrasing.',
          '   Example: if MY_RECENT_TITLES has "I tried weighted vest for 30 days", a cluster "weighted vest training" is NOT a gap.',
          '3. At most 2 clusters should be marked isGap=true (highest opportunity first).',
          '4. Be conservative: when uncertain, set isGap=false.',
        ].join('\n')
      : 'MY_RECENT_TITLES was not provided — set isGap=false for every cluster.',
    '',
    '# LANGUAGE RULES',
    `- SUMMARY: write in ${outputLang}.`,
    '- CLUSTER LABELS: keep in the dominant language of the source titles (usually same as OUTPUT_LANGUAGE, but preserve English proper nouns like product names).',
    '- Do not add translations or explanations outside the JSON.',
    '',
    '# OUTPUT QUALITY CHECKLIST (self-check before responding)',
    '[ ] JSON parses with no extra text',
    '[ ] summary is exactly 5 sentences',
    '[ ] clusters is 3-5 items (unless sparse)',
    '[ ] each videoId appears in exactly one cluster',
    '[ ] labels are specific, not generic',
    '[ ] isGap is conservative (at most 2)',
  ]
    .filter(Boolean)
    .join('\n');

  const compactVideos = videos.map((v) => ({
    videoId: v.platformId,
    title: v.title,
    viewCount: v.viewCount ?? 0,
    publishedAt: v.publishedAt,
  }));

  const user = [
    `CATEGORY: ${category.emoji} ${category.label}`,
    `CATEGORY_KEYWORDS: ${category.keywords.join(', ')}`,
    `OUTPUT_LANGUAGE: ${outputLang}`,
    '',
    `VIDEOS (${compactVideos.length}):`,
    JSON.stringify(compactVideos),
    '',
    hasMyTitles
      ? `MY_RECENT_TITLES (${myRecentTitles.length}):\n${JSON.stringify(myRecentTitles.slice(0, 50))}`
      : 'MY_RECENT_TITLES: (none)',
  ].join('\n');

  return { system, user };
}

function describeLanguage(code: string): string {
  const map: Record<string, string> = {
    auto: 'same as the dominant language of the source titles',
    en: 'English',
    ko: 'Korean (한국어)',
    ja: 'Japanese (日本語)',
    zh: 'Chinese (中文, simplified)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    id: 'Indonesian',
    vi: 'Vietnamese',
  };
  return map[code] ?? code;
}

/**
 * AI 응답 JSON 안전 파싱. fenced 블록 / 선행 텍스트 대응.
 */
export function safeJsonParse(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  // Markdown 코드펜스 제거.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }
  // 첫 { 부터 마지막 } 까지 추출.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* give up */
    }
  }
  return null;
}

/**
 * 프롬프트 길이 추정 (토큰 이전 단계 — 1 token ≈ 4 chars 영어).
 * UI에 "이번 브리프 예상 토큰" 표시 용도로 활용 가능.
 */
export function estimatePromptTokens(p: PromptPair): number {
  const totalChars = p.system.length + p.user.length;
  return Math.ceil(totalChars / 4);
}
