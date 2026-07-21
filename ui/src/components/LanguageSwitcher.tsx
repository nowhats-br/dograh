'use client';

import { useLocale } from '@/lib/i18n/LocaleContext';
import { getFlagEmoji } from '@/lib/i18n/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales, t } = useLocale();

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as typeof locale)}>
      <SelectTrigger className="w-fit gap-2 border-0 bg-transparent">
        <SelectValue>
          <span className="flex items-center gap-2">
            {getFlagEmoji(locale)} <span className="text-sm">{t(`locale.${locale}`, undefined, locale)}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((l) => (
          <SelectItem key={l} value={l}>
            <span className="flex items-center gap-2">
              {getFlagEmoji(l)} {t(`locale.${l}`, undefined, l)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
