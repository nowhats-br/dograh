import { useTranslation } from "@/lib/i18n/LocaleContext";

export function FormTrustLine() {
  const { t } = useTranslation();
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t("leadForms.trustLine.responseTime")}
    </p>
  );
}
