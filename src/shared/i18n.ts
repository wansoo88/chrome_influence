import { en, type LocaleDict, type LocaleKey } from './locales/en';

const dict: Record<string, LocaleDict> = { en };

type Params = Record<string, string | number>;

export function t(key: LocaleKey, params?: Params, lang: string = 'en'): string {
  const d = dict[lang] ?? dict.en!;
  let text: string = d[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export type { LocaleKey };
