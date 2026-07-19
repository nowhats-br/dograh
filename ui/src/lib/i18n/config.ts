export type Locale = 'en' | 'pt-BR';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'pt-BR'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isSupportedLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

export function getBrowserLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const langs = acceptLanguage.split(',').map(l => l.split(';')[0].trim());
  for (const lang of langs) {
    const matched = SUPPORTED_LOCALES.find(sl => lang.startsWith(sl));
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

export function getFlagEmoji(locale: Locale): string {
  const flags: Record<Locale, string> = { en: '🇺🇸', 'pt-BR': '🇧🇷' };
  return flags[locale] || '🌐';
}
