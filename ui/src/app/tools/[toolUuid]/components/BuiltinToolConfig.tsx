"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/LocaleContext";

export interface BuiltinToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    title: string;
    subtitle: string;
}

export function BuiltinToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    title,
    subtitle,
}: BuiltinToolConfigProps) {
    const { t } = useTranslation();
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Tool Name */}
                <div className="space-y-2">
                    <Label htmlFor="tool-name">{t("tools.detail.builtin.toolName")}</Label>
                    <Input
                        id="tool-name"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder={t("tools.detail.builtin.toolNamePlaceholder")}
                    />
                </div>

                {/* Tool Description */}
                <div className="space-y-2">
                    <Label htmlFor="tool-description">{t("tools.detail.builtin.description")}</Label>
                    <p className="text-xs text-muted-foreground">
                        {t("tools.detail.builtin.descriptionHelp")}
                    </p>
                    <Textarea
                        id="tool-description"
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={t("tools.detail.builtin.descriptionPlaceholder")}
                        rows={3}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
