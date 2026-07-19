export type Messages = typeof import('../../../messages/en.json');

let cache: Record<string, Messages> = {};

export async function loadMessages(locale: string): Promise<Messages> {
  if (cache[locale]) return cache[locale];
  const messages = locale === 'pt-BR'
    ? await import('../../../messages/pt-BR.json')
    : await import('../../../messages/en.json');
  cache[locale] = messages.default ?? messages as unknown as Messages;
  return cache[locale];
}

export function t(key: string, messages: Messages, fallback = key): string {
  const parts = key.split('.');
  let value: unknown = messages;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return fallback;
    }
  }
  return typeof value === 'string' ? value : fallback;
}
