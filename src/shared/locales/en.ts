export const en = {
  // 공통 에러
  err_yt_key_missing: 'Add your YouTube Data API key in Options to discover creators.',
  err_ai_key_missing: 'Add your AI key (OpenAI/OpenRouter) in Options to generate briefs.',
  err_category_missing: 'Pick a niche category first.',
  err_yt_quota: 'YouTube API quota exceeded for today. Try again after midnight (UTC-7).',
  err_yt_invalid: 'YouTube API key looks invalid. Verify it in Options.',
  err_ai_invalid: 'AI provider key looks invalid. Paste a fresh one in Options.',
  err_ai_rate_limit: 'AI provider is rate-limiting. Wait a minute and retry.',
  err_ai_no_credit: 'Your AI provider account is out of credits.',
  err_unknown: 'Something went wrong. Try again.',

  // Brief
  brief_loading: 'Generating your daily brief…',
  brief_empty: 'No brief yet. Pick a category and refresh.',
  brief_last_updated: 'Last updated {time}',
  brief_gap_badge: 'You have not covered this',

  // Buttons
  btn_refresh: 'Refresh brief',
  btn_open_options: 'Open Settings',
  btn_upgrade: 'Upgrade $29 lifetime',
  btn_open_x: 'Open X',
  btn_retry: 'Try again',

  // Export
  export_notion: 'Export to Notion',
  export_excel: 'Export as CSV / Sheets',
  export_gmail: 'Draft in Gmail',
  export_clipboard: 'Copy as Markdown',
} as const;

export type LocaleDict = typeof en;
export type LocaleKey = keyof LocaleDict;
