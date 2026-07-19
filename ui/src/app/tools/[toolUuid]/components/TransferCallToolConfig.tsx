"use client";

import type { RecordingResponseSchema } from "@/client/types.gen";
import { RecordingSelect, StaticTextWarning } from "@/components/flow/TextOrAudioInput";
import {
    CredentialSelector,
    KeyValueEditor,
    type KeyValueItem,
    ParameterEditor,
    PresetParameterEditor,
    type PresetToolParameter,
    type ToolParameter,
    UrlInput,
} from "@/components/http";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/LocaleContext";

import {
    type EndCallMessageType,
    type TransferDestinationSource,
} from "../../config";

export interface TransferCallToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    destinationSource: TransferDestinationSource;
    onDestinationSourceChange: (source: TransferDestinationSource) => void;
    destination: string;
    onDestinationChange: (destination: string) => void;
    messageType: EndCallMessageType;
    onMessageTypeChange: (messageType: EndCallMessageType) => void;
    customMessage: string;
    onCustomMessageChange: (message: string) => void;
    audioRecordingId: string;
    onAudioRecordingIdChange: (id: string) => void;
    recordings?: RecordingResponseSchema[];
    timeout?: number;
    onTimeoutChange: (timeout: number) => void;
    resolverUrl: string;
    onResolverUrlChange: (url: string) => void;
    resolverCredentialUuid: string;
    onResolverCredentialUuidChange: (uuid: string) => void;
    resolverHeaders: KeyValueItem[];
    onResolverHeadersChange: (headers: KeyValueItem[]) => void;
    resolverTimeoutMs: number;
    onResolverTimeoutMsChange: (timeoutMs: number) => void;
    resolverWaitMessage: string;
    onResolverWaitMessageChange: (message: string) => void;
    parameters: ToolParameter[];
    onParametersChange: (parameters: ToolParameter[]) => void;
    presetParameters: PresetToolParameter[];
    onPresetParametersChange: (parameters: PresetToolParameter[]) => void;
}

export function TransferCallToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    destinationSource,
    onDestinationSourceChange,
    destination,
    onDestinationChange,
    messageType,
    onMessageTypeChange,
    customMessage,
    onCustomMessageChange,
    audioRecordingId,
    onAudioRecordingIdChange,
    recordings = [],
    timeout,
    onTimeoutChange,
    resolverUrl,
    onResolverUrlChange,
    resolverCredentialUuid,
    onResolverCredentialUuidChange,
    resolverHeaders,
    onResolverHeadersChange,
    resolverTimeoutMs,
    onResolverTimeoutMsChange,
    resolverWaitMessage,
    onResolverWaitMessageChange,
    parameters,
    onParametersChange,
    presetParameters,
    onPresetParametersChange,
}: TransferCallToolConfigProps) {
    const { t } = useTranslation();
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("tools.detail.transferCall.title")}</CardTitle>
                <CardDescription>
                    {t("tools.detail.transferCall.description")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label>{t("tools.detail.transferCall.toolName")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.detail.transferCall.toolNameHelp")}
                    </Label>
                    <Input
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder={t("tools.detail.transferCall.toolNamePlaceholder")}
                    />
                </div>

                <div className="grid gap-2">
                    <Label>{t("tools.detail.transferCall.descriptionField")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.detail.transferCall.descriptionHelp")}
                    </Label>
                    <Textarea
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={t("tools.detail.transferCall.descriptionPlaceholder")}
                        rows={3}
                    />
                </div>

                <div className="grid gap-4 pt-4 border-t">
                    <Label>{t("tools.detail.transferCall.preTransferMessage")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.detail.transferCall.preTransferMessageHelp")}
                    </Label>
                    <RadioGroup
                        value={messageType}
                        onValueChange={(v) => onMessageTypeChange(v as EndCallMessageType)}
                        className="space-y-3"
                    >
                        <label
                            htmlFor="none"
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        >
                            <RadioGroupItem value="none" id="none" />
                            <div className="flex-1">
                                <span className="font-medium">{t("tools.detail.transferCall.option.noMessage")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.option.noMessageDescription")}
                                </p>
                            </div>
                        </label>
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                            <RadioGroupItem value="custom" id="custom" className="mt-1" />
                            <label htmlFor="custom" className="flex-1 space-y-2 cursor-pointer">
                                <span className="font-medium">{t("tools.detail.transferCall.option.customMessage")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.option.customMessageDescription")}
                                </p>
                            </label>
                        </div>
                        {messageType === "custom" && (
                            <div className="pl-8 space-y-2">
                                <StaticTextWarning />
                                <Textarea
                                    value={customMessage}
                                    onChange={(e) => onCustomMessageChange(e.target.value)}
                                    placeholder={t("tools.detail.transferCall.option.customMessagePlaceholder")}
                                    rows={2}
                                />
                            </div>
                        )}
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                            <RadioGroupItem value="audio" id="audio" className="mt-1" />
                            <label htmlFor="audio" className="flex-1 space-y-2 cursor-pointer">
                                <span className="font-medium">{t("tools.detail.transferCall.option.audio")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.option.audioDescription")}
                                </p>
                            </label>
                        </div>
                        {messageType === "audio" && (
                            <div className="pl-8">
                                <RecordingSelect
                                    value={audioRecordingId}
                                    onChange={onAudioRecordingIdChange}
                                    recordings={recordings}
                                />
                            </div>
                        )}
                    </RadioGroup>
                </div>

                <div className="grid gap-2 pt-4 border-t">
                    <Label>{t("tools.detail.transferCall.timeout")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.detail.transferCall.timeoutHelp")}
                    </Label>
                    <Input
                        type="number"
                        value={timeout ?? 30}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 30;
                            onTimeoutChange(Math.min(Math.max(value, 5), 120));
                        }}
                        placeholder={t("tools.detail.transferCall.timeoutPlaceholder")}
                        min="5"
                        max="120"
                        className="w-32"
                    />
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.detail.transferCall.timeoutDefault")}
                    </Label>
                </div>

                <div className="grid gap-4 pt-4 border-t">
                    <div>
                        <Label>{t("tools.detail.transferCall.destinationSource")}</Label>
                        <p className="text-xs text-muted-foreground">
                            {t("tools.detail.transferCall.destinationSourceHelp")}
                        </p>
                    </div>
                    <Tabs
                        value={destinationSource}
                        onValueChange={(v) => onDestinationSourceChange(v as TransferDestinationSource)}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="static">{t("tools.detail.transferCall.tab.static")}</TabsTrigger>
                            <TabsTrigger value="dynamic">{t("tools.detail.transferCall.tab.dynamic")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="static" className="space-y-4 mt-4">
                            <div className="grid gap-2">
                                <Label>{t("tools.detail.transferCall.staticDestination")}</Label>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>{t("tools.detail.transferCall.staticDestinationHelp1")}</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>{t("tools.detail.transferCall.staticDestinationHelp2")}</li>
                                        <li>{t("tools.detail.transferCall.staticDestinationHelp3")}</li>
                                        <li>
                                            {t("tools.detail.transferCall.staticDestinationHelp4")}
                                        </li>
                                    </ul>
                                </div>
                                <Input
                                    value={destination}
                                    onChange={(e) => onDestinationChange(e.target.value)}
                                    placeholder={t("tools.detail.transferCall.staticDestinationPlaceholder")}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="dynamic" className="space-y-5 mt-4">
                            <div>
                                <Label>{t("tools.detail.transferCall.dynamicTitle")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.dynamicDescription")}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>{t("tools.detail.transferCall.resolverUrl")}</Label>
                                <UrlInput
                                    value={resolverUrl}
                                    onChange={onResolverUrlChange}
                                    placeholder="https://crm.example.com/resolve-transfer"
                                    showValidation
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.resolverUrlHelp")}
                                </Label>
                            </div>

                            <div className="grid gap-2">
                                <Label>{t("tools.detail.transferCall.resolverTimeout")}</Label>
                                <Input
                                    type="number"
                                    value={resolverTimeoutMs}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 3000;
                                        onResolverTimeoutMsChange(Math.min(Math.max(value, 500), 5000));
                                    }}
                                    min="500"
                                    max="5000"
                                    className="w-36"
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.resolverTimeoutHelp")}
                                </Label>
                            </div>

                            <CredentialSelector
                                value={resolverCredentialUuid}
                                onChange={onResolverCredentialUuidChange}
                                label={t("tools.detail.transferCall.resolverCredential")}
                                description={t("tools.detail.transferCall.resolverCredentialDescription")}
                            />

                            <div className="grid gap-2">
                                <Label>{t("tools.detail.transferCall.resolverWaitMessage")}</Label>
                                <Textarea
                                    value={resolverWaitMessage}
                                    onChange={(e) => onResolverWaitMessageChange(e.target.value)}
                                    placeholder={t("tools.detail.transferCall.resolverWaitMessagePlaceholder")}
                                    rows={2}
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.resolverWaitMessageHelp")}
                                </Label>
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.detail.transferCall.llmParameters")}</Label>
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.llmParametersHelp")}
                                </Label>
                                <ParameterEditor
                                    parameters={parameters}
                                    onChange={onParametersChange}
                                />
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.detail.transferCall.presetParameters")}</Label>
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.presetParametersHelp")}
                                </Label>
                                <PresetParameterEditor
                                    parameters={presetParameters}
                                    onChange={onPresetParametersChange}
                                />
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.detail.transferCall.customHeaders")}</Label>
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.detail.transferCall.customHeadersHelp")}
                                </Label>
                                <KeyValueEditor
                                    items={resolverHeaders}
                                    onChange={onResolverHeadersChange}
                                    keyPlaceholder="Header name"
                                    valuePlaceholder="Header value"
                                    addButtonText={t("tools.detail.transferCall.addHeader")}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
}
