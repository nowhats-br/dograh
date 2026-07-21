'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from './config';
import { loadMessages, t as resolveKey, type Messages } from './messages';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number | undefined>, fallback?: string) => string;
  messages: Messages | null;
  supportedLocales: Locale[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE}=([^;]+)`));
  const val = match?.[2];
  if (val && (SUPPORTED_LOCALES as readonly string[]).includes(val)) {
    return val as Locale;
  }
  return DEFAULT_LOCALE;
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages | null>(null);

  useEffect(() => {
    const detected = getLocaleFromCookie();
    setLocaleState(detected);
    loadMessages(detected).then(setMessages);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setLocaleCookie(newLocale);
    loadMessages(newLocale).then(setMessages);
  }, []);

  const tFn = useCallback((key: string, params?: Record<string, string | number | undefined>, fallback?: string) => {
    if (!messages) return fallback ?? key;
    return resolveKey(key, messages, params, fallback);
  }, [messages]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: tFn, messages, supportedLocales: [...SUPPORTED_LOCALES] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useTranslation() {
  const { t } = useLocale();
  return { t };
}
