import type { AiProvider } from './types';

/**
 * 제공자별 메타 — UI·라우팅·기본값의 단일 진실 소스.
 *
 * 모델 목록은 "가장 자주 쓰이는 것"만 유지. OpenRouter는 수백 개 제공하므로 대표만.
 * 사용자는 드롭다운 외에 커스텀 모델 ID도 입력 가능 (Options에서 input).
 *
 * costHint는 brief 1회 생성 시 대략적 비용. 유저의 "얼마 나올까" 공포 해소용.
 */

export interface ModelOption {
  id: string; // API에 보내는 정확한 모델 ID
  label: string; // UI 표시용
  recommended?: boolean; // 드롭다운에서 기본 선택
  note?: string; // 속도·품질 간단 힌트
}

export interface ProviderMeta {
  id: AiProvider;
  label: string;
  docUrl: string; // API 키 발급 페이지
  keyPrefix?: string; // 검증 힌트 (sk-, AIza 등)
  costHintPerBrief: string; // "≈ $0.002 per brief"
  models: ModelOption[];
  /** JSON 구조화 출력을 네이티브로 지원하는지 */
  supportsJsonMode: boolean;
  /** CWS 심사 관점 주의사항 (UI 경고에 사용) */
  warning?: string;
}

export const PROVIDERS: Record<AiProvider, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    docUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    costHintPerBrief: '≈ $0.002 per brief with gpt-4o-mini',
    supportsJsonMode: true,
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', recommended: true, note: 'fast · cheap · best default' },
      { id: 'gpt-4o', label: 'GPT-4o', note: 'higher quality · ~10x cost' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', note: 'if available on your account' },
      { id: 'gpt-5', label: 'GPT-5', note: 'flagship · most expensive' },
      { id: 'o3-mini', label: 'o3 mini', note: 'reasoning · slower · structured tasks' },
    ],
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    docUrl: 'https://aistudio.google.com/app/apikey',
    keyPrefix: 'AIza',
    costHintPerBrief: '≈ $0.001 per brief with gemini-2.5-flash',
    supportsJsonMode: true,
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', recommended: true, note: 'fast · very cheap · large context' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'higher reasoning · slower' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', note: 'legacy option' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'ultra-cheap · shorter outputs' },
    ],
  },
  claude: {
    id: 'claude',
    label: 'Anthropic (Claude)',
    docUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    costHintPerBrief: '≈ $0.003 per brief with claude-3.5 haiku',
    supportsJsonMode: false, // Claude는 JSON은 prompt 지시로 유도
    warning:
      'Direct browser calls to Anthropic require the dangerous-direct-browser-access header. Works but may be flagged by Chrome Web Store reviewers. Consider OpenRouter → anthropic/claude-* for safer routing.',
    models: [
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', recommended: true, note: 'fast · cheap · great follow-instructions' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'flagship balance' },
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', note: 'most capable · most expensive' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (all models)',
    docUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    costHintPerBrief: 'varies — see openrouter.ai/models for per-token rates',
    supportsJsonMode: true,
    models: [
      { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini (via OR)', recommended: true },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku (via OR)', note: 'Claude without direct-access warnings' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OR)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
    ],
  },
};

export function getDefaultModelFor(provider: AiProvider): string {
  const meta = PROVIDERS[provider];
  const rec = meta.models.find((m) => m.recommended);
  return rec?.id ?? meta.models[0]?.id ?? '';
}

export function isKnownModel(provider: AiProvider, model: string): boolean {
  return PROVIDERS[provider].models.some((m) => m.id === model);
}
