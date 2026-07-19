"use client";

import { ExternalLink } from "lucide-react";

import { useTranslation } from "@/lib/i18n/LocaleContext";
import { MCPSection } from "@/components/MCPSection";
import { OrganizationPreferencesSection } from "@/components/OrganizationPreferencesSection";
import { TelemetrySection } from "@/components/TelemetrySection";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("settings.platformSettings.title")}</h1>
          <p className="text-muted-foreground">
            {t("settings.platformSettings.description")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.platformSettings.preferences")}</CardTitle>
            <CardDescription>
              {t("settings.platformSettings.preferencesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationPreferencesSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.platformSettings.mcpServer")}</CardTitle>
            <CardDescription>
              {t("settings.platformSettings.mcpServerDescription")}{" "}
              <a
                href="https://docs.dograh.com/integrations/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {t("common.learnMore")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MCPSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.platformSettings.telemetry")}</CardTitle>
            <CardDescription>
              {t("settings.platformSettings.telemetryDescription")}{" "}
              <a
                href="https://docs.dograh.com/configurations/tracing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {t("common.learnMore")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelemetrySection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
