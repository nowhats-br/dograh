"use client";

import { format } from "date-fns";
import { ArrowLeft, BookA, Brain, CalendarIcon, Clipboard, Download, ExternalLink, FileDown, Fingerprint, Loader2, Mic, Pause, PhoneOff, Play, Rocket, Settings, Trash2Icon, Upload, Variable, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
    downloadWorkflowReportApiV1WorkflowWorkflowIdReportGet,
    getAmbientNoiseUploadUrlApiV1WorkflowAmbientNoiseUploadUrlPost,
    getModelConfigurationV2ApiV1OrganizationsModelConfigurationsV2Get,
    getModelConfigurationV2DefaultsApiV1OrganizationsModelConfigurationsV2DefaultsGet,
    getWorkflowApiV1WorkflowFetchWorkflowIdGet,
} from "@/client/sdk.gen";
import type {
    ModelConfigurationPricingResponse,
    OrganizationAiModelConfigurationResponse,
    OrganizationAiModelConfigurationV2,
    WorkflowResponse,
} from "@/client/types.gen";
import {
    AIModelConfigurationV2Editor,
    type ModelConfigurationDefaultsV2,
} from "@/components/AIModelConfigurationV2Editor";
import { FlowEdge, FlowNode } from "@/components/flow/types";
import { LLMConfigSelector } from "@/components/LLMConfigSelector";
import SpinLoader from "@/components/SpinLoader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SETTINGS_DOCUMENTATION_URLS } from "@/constants/documentation";
import { UnsavedChangesProvider, useUnsavedChanges, useUnsavedChangesContext } from "@/context/UnsavedChangesContext";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { detailFromError } from "@/lib/apiError";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import logger from "@/lib/logger";
import { fetchModelConfigurationPricing } from "@/lib/modelConfigurationPricing";
import {
    type AmbientNoiseConfiguration,
    DEFAULT_PROVISIONAL_VAD_PAUSE_SECS,
    DEFAULT_TURN_START_MIN_WORDS,
    DEFAULT_VOICEMAIL_DETECTION_CONFIGURATION,
    resolveWorkflowConfigurations,
    TURN_START_STRATEGY_OPTIONS,
    type TurnStartStrategy,
    type TurnStopStrategy,
    type VoicemailDetectionConfiguration,
    type WorkflowConfigurations,
} from "@/types/workflow-configurations";

import { EmbedDialog } from "../components/EmbedDialog";
import { useWorkflowState } from "../hooks/useWorkflowState";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VOICEMAIL_SYSTEM_PROMPT = `You are a voicemail detection classifier for an OUTBOUND calling system. A bot has called a phone number and you need to determine if a human answered or if the call went to voicemail based on the provided text.

HUMAN ANSWERED - LIVE CONVERSATION (respond "CONVERSATION"):
- Personal greetings: "Hello?", "Hi", "Yeah?", "John speaking"
- Interactive responses: "Who is this?", "What do you want?", "Can I help you?"
- Conversational tone expecting back-and-forth dialogue
- Questions directed at the caller: "Hello? Anyone there?"
- Informal responses: "Yep", "What's up?", "Speaking"
- Natural, spontaneous speech patterns
- Immediate acknowledgment of the call

VOICEMAIL SYSTEM (respond "VOICEMAIL"):
- Automated voicemail greetings: "Hi, you've reached [name], please leave a message"
- Phone carrier messages: "The number you have dialed is not in service", "Please leave a message", "All circuits are busy"
- Professional voicemail: "This is [name], I'm not available right now"
- Instructions about leaving messages: "leave a message", "leave your name and number"
- References to callback or messaging: "call me back", "I'll get back to you"
- Carrier system messages: "mailbox is full", "has not been set up"
- Business hours messages: "our office is currently closed"

Respond with ONLY "CONVERSATION" if a person answered, or "VOICEMAIL" if it's voicemail/recording.`;

// Sidebar navigation items
const NAV_ITEMS = [
    { id: "general", label: "workflow.settings.nav.general", icon: Settings },
    { id: "models", label: "workflow.settings.nav.modelOverrides", icon: Brain },
    { id: "variables", label: "workflow.settings.nav.templateVariables", icon: Variable },
    { id: "dictionary", label: "workflow.settings.nav.dictionary", icon: BookA },
    { id: "voicemail", label: "workflow.settings.nav.voicemailDetection", icon: PhoneOff },
    { id: "recordings", label: "workflow.settings.nav.recordings", icon: Mic },
    { id: "deployment", label: "workflow.settings.nav.addToWebsite", icon: Rocket },
    { id: "report", label: "workflow.settings.nav.report", icon: FileDown },
    { id: "identity", label: "workflow.settings.nav.agentUuid", icon: Fingerprint },
];

// ---------------------------------------------------------------------------
// Section: Report
// ---------------------------------------------------------------------------

function ReportSection({ workflowId }: { workflowId: number }) {
    const { t } = useTranslation();
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [startTime, setStartTime] = useState("00:00");
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [endTime, setEndTime] = useState("23:59");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const buildDateTime = (date: Date | undefined, time: string): string | undefined => {
        if (!date) return undefined;
        const [hours, minutes] = time.split(":").map(Number);
        const combined = new Date(date);
        combined.setHours(hours, minutes, 0, 0);
        return combined.toISOString();
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        setIsPopoverOpen(false);
        try {
            const response = await downloadWorkflowReportApiV1WorkflowWorkflowIdReportGet({
                path: { workflow_id: workflowId },
                query: {
                    start_date: buildDateTime(startDate, startTime),
                    end_date: buildDateTime(endDate, endTime),
                },
                parseAs: "blob",
            });

            if (response.data) {
                const blob = response.data as Blob;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `workflow_${workflowId}_report.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                toast.error(t("workflow.settings.downloadReportFailed"));
            }
        } catch (err) {
            logger.error(`Failed to download workflow report: ${err}`);
            toast.error(t("workflow.settings.downloadReportFailed"));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleClear = () => {
        setStartDate(undefined);
        setStartTime("00:00");
        setEndDate(undefined);
        setEndTime("23:59");
    };

    return (
        <Card id="report">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <FileDown className="h-4 w-4" />
                    {t("workflow.settings.report")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.reportDescription")}
                </CardDescription>
            </CardHeader>
            <CardFooter className="border-t pt-6">
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" disabled={isDownloading}>
                            <Download className="h-4 w-4 mr-2" />
                            {t("workflow.settings.downloadReport")}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="start">
                        <div className="space-y-4">
                            <div className="text-sm font-medium">{t("workflow.settings.filterByDateRange")}</div>
                            <div className="grid gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">{t("workflow.settings.from")}</Label>
                                    <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                    {startDate ? format(startDate, "MMM dd, yyyy") : t("workflow.settings.startDate")}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={startDate}
                                                    onSelect={setStartDate}
                                                    disabled={(date) => (endDate ? date > endDate : false)}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <Input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-[100px] h-8 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">{t("workflow.settings.to")}</Label>
                                    <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                    {endDate ? format(endDate, "MMM dd, yyyy") : t("workflow.settings.endDate")}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={endDate}
                                                    onSelect={setEndDate}
                                                    disabled={(date) => (startDate ? date < startDate : false)}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <Input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-[100px] h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <Button variant="ghost" size="sm" onClick={handleClear}>
                                    {t("common.clear")}
                                </Button>
                                <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    {startDate || endDate ? t("workflow.settings.downloadFiltered") : t("workflow.settings.downloadAll")}
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: General
// ---------------------------------------------------------------------------

const MAX_AMBIENT_NOISE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function GeneralSection({
    workflowConfigurations,
    workflowName,
    workflowId,
    onSave,
}: {
    workflowConfigurations: WorkflowConfigurations;
    workflowName: string;
    workflowId: number;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState(workflowName);
    const [ambientNoiseConfig, setAmbientNoiseConfig] = useState<AmbientNoiseConfiguration>(
        workflowConfigurations.ambient_noise_configuration,
    );
    const [maxCallDuration, setMaxCallDuration] = useState(workflowConfigurations.max_call_duration);
    const [maxUserIdleTimeout, setMaxUserIdleTimeout] = useState(workflowConfigurations.max_user_idle_timeout);
    const [smartTurnStopSecs, setSmartTurnStopSecs] = useState(workflowConfigurations.smart_turn_stop_secs);
    const [turnStartStrategy, setTurnStartStrategy] = useState<TurnStartStrategy>(
        workflowConfigurations.turn_start_strategy,
    );
    const [turnStartMinWords, setTurnStartMinWords] = useState(
        workflowConfigurations.turn_start_min_words,
    );
    const [provisionalVadPauseSecs, setProvisionalVadPauseSecs] = useState(
        workflowConfigurations.provisional_vad_pause_secs,
    );
    const [turnStopStrategy, setTurnStopStrategy] = useState<TurnStopStrategy>(
        workflowConfigurations.turn_stop_strategy,
    );
    const [contextCompactionEnabled, setContextCompactionEnabled] = useState(
        workflowConfigurations.context_compaction_enabled,
    );
    const [includeTranscriptEndTimestamps, setIncludeTranscriptEndTimestamps] = useState(
        workflowConfigurations.transcript_configuration?.include_end_timestamps ?? false,
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
    const ambientFileInputRef = useRef<HTMLInputElement>(null);
    const { playingId, toggle: togglePlayback } = useAudioPlayback();
    const selectedTurnStartStrategy = TURN_START_STRATEGY_OPTIONS.find(
        (option) => option.value === turnStartStrategy,
    );

    const isDirty = useMemo(() => {
        const initAmbient = workflowConfigurations.ambient_noise_configuration;
        return (
            name !== workflowName ||
            JSON.stringify(ambientNoiseConfig) !== JSON.stringify(initAmbient) ||
            maxCallDuration !== workflowConfigurations.max_call_duration ||
            maxUserIdleTimeout !== workflowConfigurations.max_user_idle_timeout ||
            smartTurnStopSecs !== workflowConfigurations.smart_turn_stop_secs ||
            turnStartStrategy !== workflowConfigurations.turn_start_strategy ||
            turnStartMinWords !== workflowConfigurations.turn_start_min_words ||
            provisionalVadPauseSecs !== workflowConfigurations.provisional_vad_pause_secs ||
            turnStopStrategy !== workflowConfigurations.turn_stop_strategy ||
            contextCompactionEnabled !== workflowConfigurations.context_compaction_enabled ||
            includeTranscriptEndTimestamps !==
            (workflowConfigurations.transcript_configuration?.include_end_timestamps ?? false)
        );
    }, [name, workflowName, ambientNoiseConfig, maxCallDuration, maxUserIdleTimeout, smartTurnStopSecs, turnStartStrategy, turnStartMinWords, provisionalVadPauseSecs, turnStopStrategy, contextCompactionEnabled, includeTranscriptEndTimestamps, workflowConfigurations]);

    useUnsavedChanges("general", isDirty);

    const handleAmbientFileUpload = async (file: File) => {
        if (file.size > MAX_AMBIENT_NOISE_FILE_SIZE) {
            setAudioUploadError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is 10MB.`);
            return;
        }

        setIsUploadingAudio(true);
        setAudioUploadError(null);

        try {
            // 1. Get presigned upload URL
            const res = await getAmbientNoiseUploadUrlApiV1WorkflowAmbientNoiseUploadUrlPost({
                body: {
                    workflow_id: Number(workflowId),
                    filename: file.name,
                    mime_type: file.type || "audio/wav",
                    file_size: file.size,
                },
            });

            if (res.error || !res.data?.upload_url) {
                throw new Error("Failed to get upload URL");
            }

            const data = res.data;

            // 2. Upload file to storage
            const uploadRes = await fetch(data.upload_url, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type || "audio/wav" },
            });
            if (!uploadRes.ok) {
                throw new Error("File upload failed");
            }

            // 3. Update config with storage reference
            setAmbientNoiseConfig((prev) => ({
                ...prev,
                storage_key: data.storage_key,
                storage_backend: data.storage_backend,
                original_filename: file.name,
            }));
        } catch (err) {
            setAudioUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setIsUploadingAudio(false);
            if (ambientFileInputRef.current) ambientFileInputRef.current.value = "";
        }
    };

    const handleRemoveCustomAudio = () => {
        setAmbientNoiseConfig((prev) => ({
            enabled: prev.enabled,
            volume: prev.volume,
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(
                {
                    ...workflowConfigurations,
                    ambient_noise_configuration: ambientNoiseConfig,
                    max_call_duration: maxCallDuration,
                    max_user_idle_timeout: maxUserIdleTimeout,
                    smart_turn_stop_secs: smartTurnStopSecs,
                    turn_start_strategy: turnStartStrategy,
                    turn_start_min_words: turnStartMinWords,
                    provisional_vad_pause_secs: provisionalVadPauseSecs,
                    turn_stop_strategy: turnStopStrategy,
                    context_compaction_enabled: contextCompactionEnabled,
                    transcript_configuration: {
                        ...(workflowConfigurations.transcript_configuration ?? {}),
                        include_end_timestamps: includeTranscriptEndTimestamps,
                    },
                },
                name,
            );
        } catch (error) {
            console.error("Failed to save general settings:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card id="general">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="h-4 w-4" />
                    {t("workflow.settings.general")}
                </CardTitle>
                <CardDescription>{t("workflow.settings.generalDescription")}{" "}
                    <a href={SETTINGS_DOCUMENTATION_URLS.general} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">{t("common.learnMore")} <ExternalLink className="h-3 w-3" /></a>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Agent Name */}
                <div className="space-y-2">
                    <Label htmlFor="workflow_name" className="text-sm font-medium">{t("workflow.settings.agentName")}</Label>
                    <Input
                        id="workflow_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("workflow.settings.agentNamePlaceholder")}
                    />
                </div>

                <Separator />

                {/* Ambient Noise */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.ambientNoise")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.ambientNoiseDescription")}
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="ambient-noise-enabled" className="text-sm">{t("workflow.settings.useAmbientNoise")}</Label>
                        <Switch
                            id="ambient-noise-enabled"
                            checked={ambientNoiseConfig.enabled}
                            onCheckedChange={(checked) =>
                                setAmbientNoiseConfig((prev) => ({ ...prev, enabled: checked }))
                            }
                        />
                    </div>
                    {ambientNoiseConfig.enabled && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ambient-volume" className="text-xs">{t("workflow.settings.volume")}</Label>
                                <Input
                                    id="ambient-volume"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="1"
                                    value={ambientNoiseConfig.volume}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) setAmbientNoiseConfig((prev) => ({ ...prev, volume: value }));
                                    }}
                                />
                            </div>

                            {/* Custom Audio File */}
                            <div className="space-y-2">
                                <Label className="text-xs">{t("workflow.settings.customAudioFile")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("workflow.settings.customAudioFileDescription")}
                                </p>

                                {ambientNoiseConfig.storage_key ? (
                                    <div className="flex items-center gap-2 rounded-md border p-2 bg-muted/10">
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate flex-1">
                                            {ambientNoiseConfig.original_filename || t("workflow.settings.customAudio")}
                                        </code>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 shrink-0"
                                            onClick={async () => {
                                                try {
                                                    await togglePlayback(
                                                        "ambient-noise",
                                                        ambientNoiseConfig.storage_key!,
                                                        ambientNoiseConfig.storage_backend,
                                                    );
                                                } catch {
                                                    setAudioUploadError("Failed to play audio");
                                                }
                                            }}
                                        >
                                            {playingId === "ambient-noise" ? (
                                                <Pause className="w-3.5 h-3.5" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5" />
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 shrink-0"
                                            onClick={handleRemoveCustomAudio}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div>
                                        <input
                                            ref={ambientFileInputRef}
                                            type="file"
                                            accept="audio/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleAmbientFileUpload(file);
                                            }}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-sm font-normal"
                                            onClick={() => ambientFileInputRef.current?.click()}
                                            disabled={isUploadingAudio}
                                        >
                                            {isUploadingAudio ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4 mr-2" />
                                            )}
                                            {isUploadingAudio ? t("workflow.settings.uploading") : t("workflow.settings.uploadAudioFile")}
                                        </Button>
                                    </div>
                                )}

                                {audioUploadError && (
                                    <p className="text-xs text-destructive">{audioUploadError}</p>
                                )}

                                {!ambientNoiseConfig.storage_key && (
                                    <p className="text-xs text-muted-foreground italic">
                                        {t("workflow.settings.defaultOfficeAmbience")}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Turn Detection */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.turnDetection")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.turnDetectionDescription")}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="turn_stop_strategy" className="text-xs">{t("workflow.settings.detectionStrategy")}</Label>
                        <Select
                            value={turnStopStrategy}
                            onValueChange={(value: TurnStopStrategy) => setTurnStopStrategy(value)}
                        >
                            <SelectTrigger id="turn_stop_strategy">
                                <SelectValue placeholder={t("workflow.settings.selectStrategyPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="transcription">{t("workflow.settings.transcriptionBased")}</SelectItem>
                                <SelectItem value="turn_analyzer">{t("workflow.settings.smartTurnAnalyzer")}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {turnStopStrategy === "transcription"
                                ? t("workflow.settings.transcriptionDescription")
                                : t("workflow.settings.turnAnalyzerDescription")}
                        </p>
                    </div>
                    {turnStopStrategy === "turn_analyzer" && (
                        <div className="space-y-2">
                            <Label htmlFor="smart_turn_stop_secs" className="text-xs">
                                {t("workflow.settings.incompleteTurnTimeout")}
                            </Label>
                            <Input
                                id="smart_turn_stop_secs"
                                type="number"
                                step="0.5"
                                min="0.5"
                                max="10"
                                value={smartTurnStopSecs}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 0.5) setSmartTurnStopSecs(value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("workflow.settings.incompleteTurnTimeoutDescription")}
                            </p>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Interruption */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.interruption")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.interruptionDescription")}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="turn_start_strategy" className="text-xs">{t("workflow.settings.interruptionStrategy")}</Label>
                        <Select
                            value={turnStartStrategy}
                            onValueChange={(value: TurnStartStrategy) => setTurnStartStrategy(value)}
                        >
                            <SelectTrigger id="turn_start_strategy">
                                <SelectValue placeholder={t("workflow.settings.selectStrategyPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {TURN_START_STRATEGY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {selectedTurnStartStrategy?.description}
                            {turnStartStrategy === "provisional_vad" && (
                                <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {t("workflow.settings.experimental")}
                                </span>
                            )}
                        </p>
                    </div>
                    {turnStartStrategy === "min_words" && (
                        <div className="space-y-2">
                            <Label htmlFor="turn_start_min_words" className="text-xs">
                                {t("workflow.settings.minWordsBeforeInterruption")}
                            </Label>
                            <Input
                                id="turn_start_min_words"
                                type="number"
                                step="1"
                                min="1"
                                max="10"
                                value={turnStartMinWords}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1) setTurnStartMinWords(value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("workflow.settings.minWordsDescription", { default: DEFAULT_TURN_START_MIN_WORDS })}
                            </p>
                        </div>
                    )}
                    {turnStartStrategy === "provisional_vad" && (
                        <div className="space-y-2">
                            <Label htmlFor="provisional_vad_pause_secs" className="text-xs">
                                {t("workflow.settings.provisionalPause")}
                            </Label>
                            <Input
                                id="provisional_vad_pause_secs"
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="5"
                                value={provisionalVadPauseSecs}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 0.1) setProvisionalVadPauseSecs(value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("workflow.settings.provisionalPauseDescription", { default: DEFAULT_PROVISIONAL_VAD_PAUSE_SECS })}
                            </p>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Transcript */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.transcript")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.transcriptDescription")}
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="transcript-end-timestamps-enabled" className="text-sm">
                            {t("workflow.settings.enhancedTranscript")}
                        </Label>
                        <Switch
                            id="transcript-end-timestamps-enabled"
                            checked={includeTranscriptEndTimestamps}
                            onCheckedChange={setIncludeTranscriptEndTimestamps}
                        />
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {`[2026-07-06T10:00:00.000Z -> 2026-07-06T10:00:04.800Z] assistant: Can you confirm your date of birth?
[2026-07-06T10:00:06.200Z -> 2026-07-06T10:00:08.700Z] user: January fifth, nineteen ninety.`}
                        </pre>
                    </div>
                </div>

                <Separator />

                {/* Context Compaction */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.contextCompaction")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.contextCompactionDescription")}
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="context-compaction-enabled" className="text-sm">
                            {t("workflow.settings.enableContextCompaction")}
                        </Label>
                        <Switch
                            id="context-compaction-enabled"
                            checked={contextCompactionEnabled}
                            onCheckedChange={setContextCompactionEnabled}
                        />
                    </div>
                </div>

                <Separator />

                {/* Call Management */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">{t("workflow.settings.callManagement")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t("workflow.settings.callManagementDescription")}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_call_duration" className="text-xs">{t("workflow.settings.maxCallDuration")}</Label>
                            <Input
                                id="max_call_duration"
                                type="number"
                                min="1"
                                value={maxCallDuration}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value > 0) setMaxCallDuration(value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">{t("workflow.settings.maxCallDurationDefault")}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_user_idle_timeout" className="text-xs">
                                {t("workflow.settings.maxUserIdleTimeout")}
                            </Label>
                            <Input
                                id="max_user_idle_timeout"
                                type="number"
                                min="1"
                                value={maxUserIdleTimeout}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value > 0) setMaxUserIdleTimeout(value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">{t("workflow.settings.maxUserIdleTimeoutDefault")}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t pt-6">
                {isDirty && <span className="text-xs text-muted-foreground">{t("workflow.settings.unsavedChanges")}</span>}
                <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    {isSaving ? t("common.saving") : t("workflow.settings.saveGeneralSettings")}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: Template Variables
// ---------------------------------------------------------------------------

function TemplateVariablesSection({
    templateContextVariables,
    onSave,
}: {
    templateContextVariables: Record<string, string>;
    onSave: (variables: Record<string, string>) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [contextVars, setContextVars] = useState<Record<string, string>>(templateContextVariables);
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const isDirty = useMemo(() => {
        const pendingVars = newKey && newValue ? { ...contextVars, [newKey]: newValue } : contextVars;
        return JSON.stringify(pendingVars) !== JSON.stringify(templateContextVariables);
    }, [contextVars, newKey, newValue, templateContextVariables]);

    useUnsavedChanges("variables", isDirty);

    const handleAdd = () => {
        if (newKey && newValue) {
            setContextVars((prev) => ({ ...prev, [newKey]: newValue }));
        }
        setNewKey("");
        setNewValue("");
    };

    const handleRemove = (key: string) => {
        setContextVars((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let varsToSave = contextVars;
            if (newKey && newValue) {
                varsToSave = { ...varsToSave, [newKey]: newValue };
            }
            await onSave(varsToSave);
        } catch (error) {
            console.error("Failed to save variables:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card id="variables">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Variable className="h-4 w-4" />
                    {t("workflow.settings.templateVariables")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.templateVariablesDescription")}{" "}
                    <a href={SETTINGS_DOCUMENTATION_URLS.templateVariables} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">{t("common.learnMore")} <ExternalLink className="h-3 w-3" /></a>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Existing Variables */}
                {Object.entries(contextVars).length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("workflow.settings.currentVariables")}</Label>
                        {Object.entries(contextVars).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 rounded-md border p-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{key}</div>
                                    <div className="text-xs text-muted-foreground truncate">{value}</div>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => handleRemove(key)}>
                                    <Trash2Icon className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add New Variable */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">{t("workflow.settings.addNewVariable")}</Label>
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="var-key" className="text-xs">{t("workflow.settings.key")}</Label>
                            <Input
                                id="var-key"
                                placeholder={t("workflow.settings.keyPlaceholder")}
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="var-value" className="text-xs">{t("workflow.settings.value")}</Label>
                            <Input
                                id="var-value"
                                placeholder={t("workflow.settings.valuePlaceholder")}
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button size="sm" onClick={handleAdd} disabled={!newKey || !newValue}>
                        {t("workflow.settings.addVariable")}
                    </Button>
                </div>
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t pt-6">
                {isDirty && <span className="text-xs text-muted-foreground">{t("workflow.settings.unsavedChanges")}</span>}
                <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    {isSaving ? t("common.saving") : t("workflow.settings.saveVariables")}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: Dictionary
// ---------------------------------------------------------------------------

function DictionarySection({
    dictionary,
    onSave,
}: {
    dictionary: string;
    onSave: (dictionary: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [dictionaryValue, setDictionaryValue] = useState(dictionary);
    const [isSaving, setIsSaving] = useState(false);

    const isDirty = dictionaryValue !== dictionary;

    useUnsavedChanges("dictionary", isDirty);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(dictionaryValue);
        } catch (error) {
            console.error("Failed to save dictionary:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card id="dictionary">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <BookA className="h-4 w-4" />
                    {t("workflow.settings.dictionary")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.dictionaryDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea
                    placeholder={t("workflow.settings.dictionaryPlaceholder")}
                    value={dictionaryValue}
                    onChange={(e) => setDictionaryValue(e.target.value)}
                    rows={4}
                    className="resize-none"
                />
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t pt-6">
                {isDirty && <span className="text-xs text-muted-foreground">{t("workflow.settings.unsavedChanges")}</span>}
                <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    {isSaving ? t("common.saving") : t("workflow.settings.saveDictionary")}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: Voicemail Detection
// ---------------------------------------------------------------------------

function VoicemailSection({
    workflowConfigurations,
    workflowName,
    onSave,
}: {
    workflowConfigurations: WorkflowConfigurations;
    workflowName: string;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const getConfig = (): VoicemailDetectionConfiguration => ({
        ...DEFAULT_VOICEMAIL_DETECTION_CONFIGURATION,
        ...workflowConfigurations.voicemail_detection,
    });

    const [enabled, setEnabled] = useState(getConfig().enabled);
    const [useWorkflowLlm, setUseWorkflowLlm] = useState(getConfig().use_workflow_llm);
    const [provider, setProvider] = useState(getConfig().provider || "openai");
    const [model, setModel] = useState(getConfig().model || "gpt-4.1");
    const [apiKey, setApiKey] = useState(getConfig().api_key || "");
    const [systemPrompt, setSystemPrompt] = useState(getConfig().system_prompt || DEFAULT_VOICEMAIL_SYSTEM_PROMPT);
    const [longSpeechTimeout, setLongSpeechTimeout] = useState(getConfig().long_speech_timeout);
    const [isSaving, setIsSaving] = useState(false);

    const isDirty = useMemo(() => {
        const init = {
            ...DEFAULT_VOICEMAIL_DETECTION_CONFIGURATION,
            ...workflowConfigurations.voicemail_detection,
        };
        return (
            enabled !== init.enabled ||
            useWorkflowLlm !== init.use_workflow_llm ||
            provider !== (init.provider || "openai") ||
            model !== (init.model || "gpt-4.1") ||
            apiKey !== (init.api_key || "") ||
            systemPrompt !== (init.system_prompt || DEFAULT_VOICEMAIL_SYSTEM_PROMPT) ||
            longSpeechTimeout !== init.long_speech_timeout
        );
    }, [enabled, useWorkflowLlm, provider, model, apiKey, systemPrompt, longSpeechTimeout, workflowConfigurations]);

    useUnsavedChanges("voicemail", isDirty);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const voicemailConfig: VoicemailDetectionConfiguration = {
                enabled,
                use_workflow_llm: useWorkflowLlm,
                provider: useWorkflowLlm ? undefined : provider,
                model: useWorkflowLlm ? undefined : model,
                api_key: useWorkflowLlm ? undefined : apiKey,
                system_prompt:
                    systemPrompt && systemPrompt !== DEFAULT_VOICEMAIL_SYSTEM_PROMPT ? systemPrompt : undefined,
                long_speech_timeout: longSpeechTimeout,
            };
            await onSave(
                { ...workflowConfigurations, voicemail_detection: voicemailConfig },
                workflowName,
            );
        } catch (error) {
            console.error("Failed to save voicemail settings:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card id="voicemail">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <PhoneOff className="h-4 w-4" />
                    {t("workflow.settings.voicemailDetection")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.voicemailDetectionDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 rounded-md border bg-muted/20 p-2">
                    <Switch id="voicemail-enabled" checked={enabled} onCheckedChange={setEnabled} />
                    <Label htmlFor="voicemail-enabled">{t("workflow.settings.enableVoicemailDetection")}</Label>
                </div>

                {enabled && (
                    <>
                        {/* LLM Configuration */}
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2 rounded-md border bg-muted/20 p-2">
                                <Switch
                                    id="voicemail-use-workflow-llm"
                                    checked={useWorkflowLlm}
                                    onCheckedChange={setUseWorkflowLlm}
                                />
                                <Label htmlFor="voicemail-use-workflow-llm">{t("workflow.settings.useWorkflowLlm")}</Label>
                                <Label className="ml-2 text-xs text-muted-foreground">
                                    {t("workflow.settings.useWorkflowLlmDescription")}
                                </Label>
                            </div>

                            {!useWorkflowLlm && (
                                <LLMConfigSelector
                                    provider={provider}
                                    onProviderChange={setProvider}
                                    model={model}
                                    onModelChange={setModel}
                                    apiKey={apiKey}
                                    onApiKeyChange={setApiKey}
                                />
                            )}
                        </div>

                        {/* System Prompt */}
                        <div className="space-y-2">
                            <Label>{t("workflow.settings.systemPrompt")}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t("workflow.settings.systemPromptDescription")}
                            </p>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="min-h-[200px] font-mono text-xs"
                            />
                        </div>

                        {/* Timing */}
                        <div className="space-y-2 rounded-md border bg-muted/10 p-3">
                            <Label className="font-medium">{t("workflow.settings.timing")}</Label>
                            <div className="space-y-2">
                                <Label className="text-sm">{t("workflow.settings.speechCutoff")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("workflow.settings.speechCutoffDescription")}
                                </p>
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="30"
                                    value={longSpeechTimeout}
                                    onChange={(e) => setLongSpeechTimeout(parseFloat(e.target.value) || 8.0)}
                                />
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t pt-6">
                {isDirty && <span className="text-xs text-muted-foreground">{t("workflow.settings.unsavedChanges")}</span>}
                <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    {isSaving ? t("common.saving") : t("workflow.settings.saveVoicemailSettings")}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: Agent UUID
// ---------------------------------------------------------------------------

function AgentUuidSection({ workflowUuid }: { workflowUuid: string }) {
    const { t } = useTranslation();
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(workflowUuid);
            toast.success(t("workflow.settings.agentUuidCopied"));
        } catch {
            toast.error(t("workflow.settings.copyAgentUuidFailed"));
        }
    };

    return (
        <Card id="identity">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Fingerprint className="h-4 w-4" />
                    {t("workflow.settings.agentUuid")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.agentUuidDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <button
                    type="button"
                    onClick={handleCopy}
                    title={t("workflow.settings.clickToCopy")}
                    className="group flex w-full items-center gap-2 rounded-md border bg-muted/20 p-2 text-left font-mono text-xs transition-colors hover:bg-muted/40"
                >
                    <code className="flex-1 truncate">{workflowUuid}</code>
                    <Clipboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
            </CardContent>
            <CardFooter className="border-t pt-6">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Clipboard className="h-3.5 w-3.5 mr-2" />
                    {t("workflow.settings.copyUuid")}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Section: Model Overrides
// ---------------------------------------------------------------------------

function withoutModelConfigurationOverrides(configurations: WorkflowConfigurations): WorkflowConfigurations {
    const next = { ...configurations };
    delete next.model_overrides;
    delete next.model_configuration_v2_override;
    return next;
}

function WorkflowModelOverridesSection({
    workflowConfigurations,
    workflowName,
    onSave,
    modelConfigurationDefaults,
    organizationModelConfiguration,
    modelConfigurationPricing,
    modelConfigurationLoading,
    modelConfigurationError,
}: {
    workflowConfigurations: WorkflowConfigurations;
    workflowName: string;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
    modelConfigurationDefaults: ModelConfigurationDefaultsV2 | null;
    organizationModelConfiguration: OrganizationAiModelConfigurationResponse | null;
    modelConfigurationPricing: ModelConfigurationPricingResponse | null;
    modelConfigurationLoading: boolean;
    modelConfigurationError: string | null;
}) {
    const { t } = useTranslation();
    const savedV2Override = workflowConfigurations.model_configuration_v2_override;
    const hasSavedModelOverride = Boolean(savedV2Override || workflowConfigurations.model_overrides);
    const [overrideEnabled, setOverrideEnabled] = useState(Boolean(savedV2Override));
    const [isRemovingOverride, setIsRemovingOverride] = useState(false);

    useEffect(() => {
        setOverrideEnabled(Boolean(workflowConfigurations.model_configuration_v2_override));
    }, [workflowConfigurations.model_configuration_v2_override]);

    const hasOrgConfiguration = organizationModelConfiguration?.source === "organization_v2";

    const saveV2Override = async (configuration: OrganizationAiModelConfigurationV2) => {
        const nextConfigurations = withoutModelConfigurationOverrides(workflowConfigurations);
        nextConfigurations.model_configuration_v2_override = configuration;
        await onSave(nextConfigurations, workflowName);
        toast.success(t("workflow.settings.modelOverrideSaved"));
    };

    const removeV2Override = async () => {
        setIsRemovingOverride(true);
        try {
            await onSave(withoutModelConfigurationOverrides(workflowConfigurations), workflowName);
            setOverrideEnabled(false);
            toast.success(t("workflow.settings.usingOrgModelConfig"));
        } finally {
            setIsRemovingOverride(false);
        }
    };

    return (
        <Card id="models">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4" />
                    {t("workflow.settings.modelOverrides")}
                </CardTitle>
                <CardDescription>
                    {t("workflow.settings.modelOverridesDescription")}{" "}
                    <a href={SETTINGS_DOCUMENTATION_URLS.modelOverrides} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">{t("common.learnMore")} <ExternalLink className="h-3 w-3" /></a>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {modelConfigurationLoading && (
                    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("workflow.settings.loadingModelConfig")}
                    </div>
                )}

                {modelConfigurationError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {modelConfigurationError}
                    </div>
                )}

                {!modelConfigurationLoading && !modelConfigurationError && !hasOrgConfiguration && (
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {t("workflow.settings.setupOrgModelConfig")}
                        </p>
                        <Button type="button" variant="outline" size="sm" asChild>
                            <Link href="/model-configurations">{t("workflow.settings.configureModels")}</Link>
                        </Button>
                    </div>
                )}

                {!modelConfigurationLoading && !modelConfigurationError && hasOrgConfiguration && modelConfigurationDefaults && organizationModelConfiguration && (
                    <>
                        <div className="flex items-center justify-between rounded-md border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="workflow-model-v2-override" className="text-sm font-medium">
                                    {t("workflow.settings.overrideForWorkflow")}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {overrideEnabled
                                        ? t("workflow.settings.usesOwnModelConfig")
                                        : t("workflow.settings.usesOrgModelConfig")}
                                </p>
                            </div>
                            <Switch
                                id="workflow-model-v2-override"
                                checked={overrideEnabled}
                                onCheckedChange={setOverrideEnabled}
                            />
                        </div>

                        {overrideEnabled ? (
                            <AIModelConfigurationV2Editor
                                defaults={modelConfigurationDefaults}
                                configuration={
                                    (savedV2Override as OrganizationAiModelConfigurationV2 | undefined)
                                    || (organizationModelConfiguration.configuration as OrganizationAiModelConfigurationV2 | null)
                                }
                                effectiveConfiguration={
                                    savedV2Override
                                        ? null
                                        : organizationModelConfiguration.effective_configuration
                                }
                                pricing={modelConfigurationPricing}
                                submitLabel={t("workflow.settings.saveModelOverride")}
                                onSave={saveV2Override}
                            />
                        ) : (
                            <div className="rounded-md border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">
                                    {t("workflow.settings.usingOrgModelConfig")}
                                </p>
                                {hasSavedModelOverride && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="mt-3"
                                        onClick={removeV2Override}
                                        disabled={isRemovingOverride}
                                    >
                                        {isRemovingOverride ? t("common.saving") : t("workflow.settings.saveOrgConfig")}
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page wrapper — handles auth & data fetching, then mounts the content
// component only when everything is loaded. This avoids useWorkflowState
// running with empty initial values and overwriting the Zustand store.
// ---------------------------------------------------------------------------

export default function WorkflowSettingsPage() {
    const { t } = useTranslation();
    const params = useParams();
    const { user, redirectToLogin, loading: authLoading } = useAuth();
    const [workflow, setWorkflow] = useState<WorkflowResponse | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            redirectToLogin();
        }
    }, [authLoading, user, redirectToLogin]);

    useEffect(() => {
        const fetchWorkflow = async () => {
            if (!user) return;
            try {
                const response = await getWorkflowApiV1WorkflowFetchWorkflowIdGet({
                    path: { workflow_id: Number(params.workflowId) },
                });
                setWorkflow(response.data);
            } catch (err) {
                setError(t("workflow.settings.fetchFailed"));
                logger.error(`Error fetching workflow settings: ${err}`);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchWorkflow();
    }, [params.workflowId, user]);

    if (loading || authLoading) return <SpinLoader />;

    if (error || !workflow) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg text-destructive">{error || t("workflow.settings.workflowNotFound")}</div>
            </div>
        );
    }

    if (!user) return null;

    return <WorkflowSettingsContent workflow={workflow} user={user} />;
}

// ---------------------------------------------------------------------------
// Content — only mounts once the workflow API response is available, so
// useWorkflowState always initialises with real data.
// ---------------------------------------------------------------------------

function WorkflowSettingsContent({
    workflow,
    user,
}: {
    workflow: WorkflowResponse;
    user: { id: string; email?: string };
}) {
    return (
        <UnsavedChangesProvider>
            <WorkflowSettingsInner workflow={workflow} user={user} />
        </UnsavedChangesProvider>
    );
}

function WorkflowSettingsInner({
    workflow,
    user,
}: {
    workflow: WorkflowResponse;
    user: { id: string; email?: string };
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const { dirtySections, confirmNavigate } = useUnsavedChangesContext();

    const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
    const [activeSection, setActiveSection] = useState("general");
    const [modelConfigurationDefaults, setModelConfigurationDefaults] = useState<ModelConfigurationDefaultsV2 | null>(null);
    const [organizationModelConfiguration, setOrganizationModelConfiguration] = useState<OrganizationAiModelConfigurationResponse | null>(null);
    const [modelConfigurationPricing, setModelConfigurationPricing] = useState<ModelConfigurationPricingResponse | null>(null);
    const [modelConfigurationLoading, setModelConfigurationLoading] = useState(true);
    const [modelConfigurationError, setModelConfigurationError] = useState<string | null>(null);
    const hasFetchedModelConfiguration = useRef(false);

    const workflowId = workflow.id;

    const initialFlow = useMemo(
        () => ({
            nodes: workflow.workflow_definition.nodes as FlowNode[],
            edges: workflow.workflow_definition.edges as FlowEdge[],
            viewport: { x: 0, y: 0, zoom: 0 },
        }),
        [workflow],
    );

    const initialTemplateContextVariables = useMemo(
        () => (workflow.template_context_variables as Record<string, string>) || {},
        [workflow],
    );

    const initialWorkflowConfigurations = useMemo(
        () => (
            workflow.workflow_configurations
                ? (workflow.workflow_configurations as WorkflowConfigurations)
                : undefined
        ),
        [workflow],
    );

    const {
        workflowName,
        workflowConfigurations,
        templateContextVariables,
        dictionary,
        saveWorkflowConfigurations,
        saveTemplateContextVariables,
        saveDictionary,
    } = useWorkflowState({
        initialWorkflowName: workflow.name,
        workflowId,
        initialFlow,
        initialTemplateContextVariables,
        initialWorkflowConfigurations,
        user,
    });
    const resolvedWorkflowConfigurationsForRender = workflowConfigurations
        ? resolveWorkflowConfigurations(workflowConfigurations)
        : null;

    useEffect(() => {
        if (hasFetchedModelConfiguration.current) return;
        hasFetchedModelConfiguration.current = true;

        const loadModelConfiguration = async () => {
            setModelConfigurationLoading(true);
            setModelConfigurationError(null);
            const [defaultsResult, configurationResult, pricingResult] = await Promise.all([
                getModelConfigurationV2DefaultsApiV1OrganizationsModelConfigurationsV2DefaultsGet(),
                getModelConfigurationV2ApiV1OrganizationsModelConfigurationsV2Get(),
                fetchModelConfigurationPricing(),
            ]);

            if (defaultsResult.error) {
                setModelConfigurationError(detailFromError(defaultsResult.error, "Failed to load model configuration defaults"));
                setModelConfigurationLoading(false);
                return;
            }
            if (configurationResult.error) {
                setModelConfigurationError(detailFromError(configurationResult.error, "Failed to load model configuration"));
                setModelConfigurationLoading(false);
                return;
            }

            setModelConfigurationDefaults(defaultsResult.data as ModelConfigurationDefaultsV2);
            setOrganizationModelConfiguration(configurationResult.data || null);
            setModelConfigurationPricing(pricingResult);
            setModelConfigurationLoading(false);
        };

        loadModelConfiguration();
    }, []);

    // Intersection observer for active sidebar link
    useEffect(() => {
        const ids = NAV_ITEMS.map((n) => n.id);
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                        break;
                    }
                }
            },
            { rootMargin: "-20% 0px -60% 0px" },
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen">
            {/* Sticky header */}
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmNavigate(() => router.push(`/workflow/${workflowId}`))}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <p className="text-xs text-muted-foreground">{t("workflow.settings.pageTitle")}</p>
                    <h1 className="text-sm font-semibold">{workflowName || workflow.name}</h1>
                </div>
            </header>

            {/* Main + right nav */}
            <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
                {/* Sections */}
                <div className="min-w-0 flex-1 space-y-8">
                    {resolvedWorkflowConfigurationsForRender && (
                        <>
                            {/* General */}
                            <GeneralSection
                                workflowConfigurations={resolvedWorkflowConfigurationsForRender}
                                workflowName={workflowName || workflow.name}
                                workflowId={workflowId}
                                onSave={saveWorkflowConfigurations}
                            />

                            <WorkflowModelOverridesSection
                                workflowConfigurations={resolvedWorkflowConfigurationsForRender}
                                workflowName={workflowName}
                                onSave={saveWorkflowConfigurations}
                                modelConfigurationDefaults={modelConfigurationDefaults}
                                organizationModelConfiguration={organizationModelConfiguration}
                                modelConfigurationPricing={modelConfigurationPricing}
                                modelConfigurationLoading={modelConfigurationLoading}
                                modelConfigurationError={modelConfigurationError}
                            />

                            {/* Template Variables */}
                            <TemplateVariablesSection
                                templateContextVariables={templateContextVariables}
                                onSave={saveTemplateContextVariables}
                            />

                            {/* Dictionary */}
                            <DictionarySection dictionary={dictionary} onSave={saveDictionary} />

                            {/* Voicemail Detection */}
                            <VoicemailSection
                                workflowConfigurations={resolvedWorkflowConfigurationsForRender}
                                workflowName={workflowName}
                                onSave={saveWorkflowConfigurations}
                            />

                            {/* Recordings – moved to org-level page */}
                            <Card id="recordings">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Mic className="h-4 w-4" />
                                        {t("workflow.settings.recordings")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("workflow.settings.recordingsDescription")}{" "}
                                        <a href={SETTINGS_DOCUMENTATION_URLS.recordings} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">{t("common.learnMore")} <ExternalLink className="h-3 w-3" /></a>
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="border-t pt-6">
                                    <Button variant="outline" asChild>
                                        <Link href="/recordings">
                                            {t("workflow.settings.goToRecordings")}
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>

                            {/* Deployment (dialog trigger) */}
                            <Card id="deployment">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Rocket className="h-4 w-4" />
                                        {t("workflow.settings.addToWebsite")}
                                    </CardTitle>
                                    <CardDescription>
                                        {t("workflow.settings.addToWebsiteDescription")}{" "}
                                        <a href={SETTINGS_DOCUMENTATION_URLS.deployment} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">{t("common.learnMore")} <ExternalLink className="h-3 w-3" /></a>
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="border-t pt-6">
                                    <Button variant="outline" onClick={() => setIsEmbedDialogOpen(true)}>
                                        {t("workflow.settings.configureWidget")}
                                    </Button>
                                </CardFooter>
                            </Card>

                            {/* Report */}
                            <ReportSection workflowId={workflowId} />

                            {/* Agent UUID */}
                            {workflow.workflow_uuid && (
                                <AgentUuidSection workflowUuid={workflow.workflow_uuid} />
                            )}
                        </>
                    )}
                </div>

                {/* ---- Right-side sticky nav ---- */}
                <nav className="hidden w-44 shrink-0 lg:block">
                    <div className="sticky top-20 space-y-1">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t("workflow.settings.onThisPage")}
                        </p>
                        {NAV_ITEMS.map((item) => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:text-foreground ${
                                    activeSection === item.id
                                        ? "font-medium text-foreground"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {t(item.label)}
                                {dirtySections.has(item.id) && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                )}
                            </a>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Dialogs for complex sections */}
            <EmbedDialog
                open={isEmbedDialogOpen}
                onOpenChange={setIsEmbedDialogOpen}
                workflowId={workflowId}
                workflowName={workflowName || workflow.name}
            />
        </div>
    );
}
