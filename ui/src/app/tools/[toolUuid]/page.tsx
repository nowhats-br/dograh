"use client";

import { ArrowLeft, Code, ExternalLink, FlaskConical, Loader2, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
    getToolApiV1ToolsToolUuidGet,
    listRecordingsApiV1WorkflowRecordingsGet,
    updateToolApiV1ToolsToolUuidPut,
} from "@/client/sdk.gen";
import type {
    EndCallConfig,
    HttpApiToolDefinition,
    RecordingResponseSchema,
    ToolResponse,
    UpdateToolRequest,
} from "@/client/types.gen";
import {
    CredentialSelector,
    type HttpMethod,
    type KeyValueItem,
    type ParameterType,
    type PresetToolParameter,
    type ToolParameter,
    validateUrl,
} from "@/components/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOL_DOCUMENTATION_URLS } from "@/constants/documentation";
import { detailFromError } from "@/lib/apiError";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/LocaleContext";

import {
    createMcpDefinition,
    type EndCallMessageType,
    type ExtendedTransferCallConfig,
    getCategoryConfig,
    getToolTypeLabel,
    MCP_URL_PATTERN,
    renderToolIcon,
    type ToolCategory,
    type TransferDestinationSource,
} from "../config";
import {
    buildHttpToolTestSnapshot,
    BuiltinToolConfig,
    EndCallToolConfig,
    HttpApiToolConfig,
    HttpToolTestDialog,
    TransferCallToolConfig,
} from "./components";

function normalizeParameterType(value: string | null | undefined): ParameterType {
    switch (value) {
        case "number":
        case "boolean":
        case "object":
        case "array":
            return value;
        default:
            return "string";
    }
}

function headersToRows(headers: Record<string, string> | undefined | null): KeyValueItem[] {
    if (!headers) return [];
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

export default function ToolDetailPage() {
    const { t } = useTranslation();
    const { toolUuid } = useParams<{ toolUuid: string }>();
    const { user, getAccessToken, redirectToLogin, loading } = useAuth();
    const router = useRouter();

    const [tool, setTool] = useState<ToolResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showCodeDialog, setShowCodeDialog] = useState(false);
    const [showTestDialog, setShowTestDialog] = useState(false);
    const [savedHttpTestSnapshot, setSavedHttpTestSnapshot] = useState<string | null>(null);

    // Common form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    // Shared form state
    const [customMessage, setCustomMessage] = useState("");

    // HTTP API form state
    const [httpMethod, setHttpMethod] = useState<HttpMethod>("POST");
    const [url, setUrl] = useState("");
    const [credentialUuid, setCredentialUuid] = useState("");
    const [headers, setHeaders] = useState<KeyValueItem[]>([]);
    const [parameters, setParameters] = useState<ToolParameter[]>([]);
    const [presetParameters, setPresetParameters] = useState<PresetToolParameter[]>([]);
    const [timeoutMs, setTimeoutMs] = useState(5000);

    // End Call form state
    const [endCallMessageType, setEndCallMessageType] = useState<EndCallMessageType>("none");
    const [endCallReason, setEndCallReason] = useState(false);
    const [endCallReasonDescription, setEndCallReasonDescription] = useState("");
    const [audioRecordingId, setAudioRecordingId] = useState("");

    const handleEndCallReasonChange = (enabled: boolean) => {
        setEndCallReason(enabled);
        if (enabled && !endCallReasonDescription) {
            setEndCallReasonDescription(t("tools.config.defaultEndCallReasonDescription"));
        }
    };

    // Transfer Call form state
    const [transferDestinationSource, setTransferDestinationSource] =
        useState<TransferDestinationSource>("static");
    const [transferDestination, setTransferDestination] = useState("");
    const [transferMessageType, setTransferMessageType] = useState<EndCallMessageType>("none");
    const [transferTimeout, setTransferTimeout] = useState(30);
    const [transferAudioRecordingId, setTransferAudioRecordingId] = useState("");
    const [transferResolverUrl, setTransferResolverUrl] = useState("");
    const [transferResolverCredentialUuid, setTransferResolverCredentialUuid] = useState("");
    const [transferResolverHeaders, setTransferResolverHeaders] = useState<KeyValueItem[]>([]);
    const [transferResolverTimeoutMs, setTransferResolverTimeoutMs] = useState(3000);
    const [transferResolverWaitMessage, setTransferResolverWaitMessage] = useState("");
    const [transferParameters, setTransferParameters] = useState<ToolParameter[]>([]);
    const [transferPresetParameters, setTransferPresetParameters] = useState<PresetToolParameter[]>([]);

    // HTTP API form state - custom message type
    const [customMessageType, setCustomMessageType] = useState<'text' | 'audio'>('text');
    const [customMessageRecordingId, setCustomMessageRecordingId] = useState("");

    // MCP form state
    const [mcpUrl, setMcpUrl] = useState("");
    const [mcpCredentialUuid, setMcpCredentialUuid] = useState("");
    const [mcpToolsFilter, setMcpToolsFilter] = useState("");

    // Org-level recordings for audio dropdowns
    const [recordings, setRecordings] = useState<RecordingResponseSchema[]>([]);

    // Redirect if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            redirectToLogin();
        }
    }, [loading, user, redirectToLogin]);

    const fetchTool = useCallback(async () => {
        if (loading || !user || !toolUuid) return;

        try {
            setIsLoading(true);
            setError(null);
            const accessToken = await getAccessToken();

            const response = await getToolApiV1ToolsToolUuidGet({
                path: { tool_uuid: toolUuid },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.data) {
                setTool(response.data);
                populateFormFromTool(response.data);
            }
        } catch (err) {
            setError(t("tools.detail.fetchError"));
            console.error("Error fetching tool:", err);
        } finally {
            setIsLoading(false);
        }
    }, [loading, user, toolUuid, getAccessToken]);

    const populateFormFromTool = (tool: ToolResponse) => {
        setName(tool.name);
        setDescription(tool.description || "");

        if (tool.category === "end_call") {
            // Populate end call specific fields
            const config = tool.definition?.config as EndCallConfig | undefined;
            if (config) {
                setEndCallMessageType(config.messageType || "none");
                setCustomMessage(config.customMessage || "");
                setAudioRecordingId(config.audioRecordingId || "");
                setEndCallReason(config.endCallReason ?? false);
                setEndCallReasonDescription(config.endCallReasonDescription || "");
            } else {
                setEndCallMessageType("none");
                setCustomMessage("");
                setAudioRecordingId("");
                setEndCallReason(false);
                setEndCallReasonDescription("");
            }
        } else if (tool.category === "transfer_call") {
            // Populate transfer call specific fields
            const config = tool.definition?.config as ExtendedTransferCallConfig | undefined;
            if (config) {
                const resolver = config.resolver || undefined;
                setTransferDestinationSource(config.destination_source || (resolver ? "dynamic" : "static"));
                setTransferDestination(config.destination || "");
                setTransferMessageType(config.messageType || "none");
                setCustomMessage(config.customMessage || "");
                setTransferAudioRecordingId(config.audioRecordingId || "");
                setTransferTimeout(config.timeout ?? 30);
                setTransferResolverUrl(resolver?.url || "");
                setTransferResolverCredentialUuid(resolver?.credential_uuid || "");
                setTransferResolverHeaders(headersToRows(resolver?.headers));
                setTransferResolverTimeoutMs(resolver?.timeout_ms ?? 3000);
                setTransferResolverWaitMessage(resolver?.wait_message || "");
                setTransferParameters(
                    (resolver?.parameters || config.parameters || []).map((p) => ({
                        name: p.name || "",
                        type: normalizeParameterType(p.type),
                        description: p.description || "",
                        required: p.required ?? true,
                    })),
                );
                setTransferPresetParameters(
                    (resolver?.preset_parameters || []).map((p) => ({
                        name: p.name || "",
                        type: normalizeParameterType(p.type),
                        valueTemplate: p.value_template || "",
                        required: p.required ?? true,
                    })),
                );
            } else {
                setTransferDestinationSource("static");
                setTransferDestination("");
                setTransferMessageType("none");
                setCustomMessage("");
                setTransferAudioRecordingId("");
                setTransferTimeout(30);
                setTransferResolverUrl("");
                setTransferResolverCredentialUuid("");
                setTransferResolverHeaders([]);
                setTransferResolverTimeoutMs(3000);
                setTransferResolverWaitMessage("");
                setTransferParameters([]);
                setTransferPresetParameters([]);
            }
        } else if (tool.category === "mcp") {
            // Populate MCP specific fields
            const config = tool.definition?.config as
                | { url?: string; credential_uuid?: string | null; tools_filter?: string[] }
                | undefined;
            if (config) {
                setMcpUrl(config.url || "");
                setMcpCredentialUuid(config.credential_uuid || "");
                setMcpToolsFilter(
                    Array.isArray(config.tools_filter)
                        ? config.tools_filter.join(", ")
                        : ""
                );
            } else {
                setMcpUrl("");
                setMcpCredentialUuid("");
                setMcpToolsFilter("");
            }
        } else {
            // Populate HTTP API specific fields
            const config = tool.definition?.config as HttpApiToolDefinition["config"] | undefined;
            if (config) {
                const loadedHttpMethod = (config.method as HttpMethod) || "POST";
                const loadedUrl = config.url || "";
                const loadedCredentialUuid = config.credential_uuid || "";
                const loadedTimeoutMs = config.timeout_ms || 5000;
                const loadedCustomMessage = config.customMessage || "";
                const loadedCustomMessageType = config.customMessageType || "text";
                const loadedCustomMessageRecordingId = config.customMessageRecordingId || "";
                setHttpMethod(loadedHttpMethod);
                setUrl(loadedUrl);
                setCredentialUuid(loadedCredentialUuid);
                setTimeoutMs(loadedTimeoutMs);
                setCustomMessage(loadedCustomMessage);
                setCustomMessageType(loadedCustomMessageType);
                setCustomMessageRecordingId(loadedCustomMessageRecordingId);

                // Convert headers object to array
                const loadedHeaders = config.headers
                    ? Object.entries(config.headers).map(([key, value]) => ({
                        key,
                        value: value as string,
                    }))
                    : [];
                setHeaders(loadedHeaders);

                // Load parameters
                let loadedParameters: ToolParameter[] = [];
                if (config.parameters && Array.isArray(config.parameters)) {
                    loadedParameters = config.parameters.map((p) => ({
                        name: p.name || "",
                        type: normalizeParameterType(p.type),
                        description: p.description || "",
                        required: p.required ?? true,
                    }));
                    setParameters(loadedParameters);
                } else {
                    setParameters([]);
                }

                let loadedPresetParameters: PresetToolParameter[] = [];
                if (config.preset_parameters && Array.isArray(config.preset_parameters)) {
                    loadedPresetParameters = config.preset_parameters.map((p) => ({
                        name: p.name || "",
                        type: normalizeParameterType(p.type),
                        valueTemplate: p.value_template || "",
                        required: p.required ?? true,
                    }));
                    setPresetParameters(loadedPresetParameters);
                } else {
                    setPresetParameters([]);
                }

                setSavedHttpTestSnapshot(
                    buildHttpToolTestSnapshot({
                        name: tool.name,
                        description: tool.description || "",
                        httpMethod: loadedHttpMethod,
                        url: loadedUrl,
                        credentialUuid: loadedCredentialUuid,
                        headers: loadedHeaders,
                        parameters: loadedParameters,
                        presetParameters: loadedPresetParameters,
                        timeoutMs: loadedTimeoutMs,
                        customMessage: loadedCustomMessage,
                        customMessageType: loadedCustomMessageType,
                        customMessageRecordingId: loadedCustomMessageRecordingId,
                    })
                );
            }
        }
    };

    const fetchRecordings = useCallback(async () => {
        if (loading || !user) return;
        try {
            const response = await listRecordingsApiV1WorkflowRecordingsGet({
                query: {},
            });
            if (response.data) {
                setRecordings(response.data.recordings);
            }
        } catch {
            // Non-critical
        }
    }, [loading, user]);

    useEffect(() => {
        fetchTool();
        fetchRecordings();
    }, [fetchTool, fetchRecordings]);

    const handleSave = async () => {
        if (!tool) return;

        const normalizedTransferDestination = transferDestination.trim();

        // Validation based on tool type
        if (tool.category === "calculator") {
            // No validation needed for built-in tools
        } else if (tool.category === "transfer_call") {
            if (transferDestinationSource === "static" && !normalizedTransferDestination) {
                setError(t("tools.detail.transferDestinationRequired"));
                return;
            }
            if (transferDestinationSource === "dynamic") {
                const resolverUrlValidation = validateUrl(transferResolverUrl);
                if (!resolverUrlValidation.valid) {
                    setError(resolverUrlValidation.error || t("tools.detail.invalidResolverUrl"));
                    return;
                }

                const invalidTransferParams = transferParameters.filter(
                    (p) => !p.name.trim() || !p.description.trim()
                );
                if (invalidTransferParams.length > 0) {
                    setError(t("tools.detail.allResolverArgumentsRequired"));
                    return;
                }
                const transferParamNames = transferParameters
                    .map((p) => p.name.trim())
                    .filter(Boolean);
                if (new Set(transferParamNames).size !== transferParamNames.length) {
                    setError(t("tools.detail.resolverArgumentNamesUnique"));
                    return;
                }
                const invalidPresetTransferParams = transferPresetParameters.filter(
                    (p) => !p.name.trim() || !p.valueTemplate.trim()
                );
                if (invalidPresetTransferParams.length > 0) {
                    setError(t("tools.detail.allResolverPresetParamsRequired"));
                    return;
                }
                const transferPresetParamNames = transferPresetParameters
                    .map((p) => p.name.trim())
                    .filter(Boolean);
                if (new Set(transferPresetParamNames).size !== transferPresetParamNames.length) {
                    setError(t("tools.detail.resolverPresetParamNamesUnique"));
                    return;
                }
            }
        } else if (tool.category === "mcp") {
            if (!mcpUrl.trim()) {
                setError(t("tools.detail.mcpUrlRequired"));
                return;
            }
            if (!MCP_URL_PATTERN.test(mcpUrl.trim())) {
                setError(t("tools.detail.mcpUrlInvalid"));
                return;
            }
        } else if (tool.category !== "end_call") {
            const urlValidation = validateUrl(url);
            if (!urlValidation.valid) {
                setError(urlValidation.error || t("tools.detail.invalidUrl"));
                return;
            }

            const invalidParams = parameters.filter((p) => !p.name.trim());
            if (invalidParams.length > 0) {
                setError(t("tools.detail.allParamsMustHaveName"));
                return;
            }
            const paramNames = parameters.map((p) => p.name.trim()).filter(Boolean);
            if (new Set(paramNames).size !== paramNames.length) {
                setError(t("tools.detail.paramNamesMustBeUnique"));
                return;
            }

            const invalidPresetParams = presetParameters.filter(
                (p) => !p.name.trim() || !p.valueTemplate.trim()
            );
            if (invalidPresetParams.length > 0) {
                setError(t("tools.detail.allPresetParamsMustHaveNameAndValue"));
                return;
            }
        }

        try {
            setIsSaving(true);
            setError(null);
            setSaveSuccess(false);
            const accessToken = await getAccessToken();

            let requestBody: UpdateToolRequest;

            if (tool.category === "calculator") {
                // Built-in tool - only name/description, no config
                requestBody = {
                    name,
                    description: description || undefined,
                    definition: {
                        schema_version: 1,
                        type: "calculator",
                    },
                };
            } else if (tool.category === "end_call") {
                // Build end call request body
                requestBody = {
                    name,
                    description: description || undefined,
                    definition: {
                        schema_version: 1,
                        type: "end_call",
                        config: {
                            messageType: endCallMessageType,
                            customMessage: endCallMessageType === "custom" ? customMessage : undefined,
                            audioRecordingId: endCallMessageType === "audio" ? audioRecordingId || undefined : undefined,
                            endCallReason,
                            endCallReasonDescription: endCallReason ? endCallReasonDescription || undefined : undefined,
                        },
                    },
                };
            } else if (tool.category === "transfer_call") {
                const resolverHeadersObject: Record<string, string> = {};
                transferResolverHeaders.filter((h) => h.key && h.value).forEach((h) => {
                    resolverHeadersObject[h.key] = h.value;
                });

                const validTransferParameters = transferParameters.filter((p) => p.name.trim());
                const validTransferPresetParameters = transferPresetParameters.filter(
                    (p) => p.name.trim() && p.valueTemplate.trim()
                );

                const transferConfig: ExtendedTransferCallConfig = {
                    destination_source: transferDestinationSource,
                    destination: transferDestinationSource === "static" ? normalizedTransferDestination : "",
                    messageType: transferMessageType,
                    customMessage: transferMessageType === "custom" ? customMessage : undefined,
                    audioRecordingId: transferMessageType === "audio" ? transferAudioRecordingId || undefined : undefined,
                    timeout: transferTimeout,
                    resolver: transferDestinationSource === "dynamic"
                        ? {
                            type: "http",
                            url: transferResolverUrl.trim(),
                            credential_uuid: transferResolverCredentialUuid || undefined,
                            headers:
                                Object.keys(resolverHeadersObject).length > 0
                                    ? resolverHeadersObject
                                    : undefined,
                            timeout_ms: transferResolverTimeoutMs,
                            wait_message: transferResolverWaitMessage.trim() || undefined,
                            parameters:
                                validTransferParameters.length > 0
                                    ? validTransferParameters.map((p) => ({
                                        name: p.name.trim(),
                                        type: p.type,
                                        description: p.description.trim(),
                                        required: p.required,
                                    }))
                                    : undefined,
                            preset_parameters:
                                validTransferPresetParameters.length > 0
                                    ? validTransferPresetParameters.map((p) => ({
                                        name: p.name.trim(),
                                        type: p.type,
                                        value_template: p.valueTemplate.trim(),
                                        required: p.required,
                                    }))
                                    : undefined,
                        }
                        : undefined,
                };
                // Build transfer call request body
                requestBody = {
                    name,
                    description: description || undefined,
                    definition: {
                        schema_version: 1,
                        type: "transfer_call",
                        config: transferConfig,
                    } as UpdateToolRequest["definition"],
                };
            } else if (tool.category === "mcp") {
                requestBody = {
                    name,
                    description: description || undefined,
                    definition: createMcpDefinition(mcpUrl, mcpCredentialUuid, mcpToolsFilter),
                };
            } else {
                // Build HTTP API request body
                const headersObject: Record<string, string> = {};
                headers.filter((h) => h.key && h.value).forEach((h) => {
                    headersObject[h.key] = h.value;
                });

                const validParameters = parameters.filter((p) => p.name.trim());
                const validPresetParameters = presetParameters.filter(
                    (p) => p.name.trim() && p.valueTemplate.trim()
                );

                requestBody = {
                    name,
                    description: description || undefined,
                    definition: {
                        schema_version: 1,
                        type: "http_api",
                        config: {
                            method: httpMethod,
                            url,
                            credential_uuid: credentialUuid || undefined,
                            headers:
                                Object.keys(headersObject).length > 0
                                    ? headersObject
                                    : undefined,
                            parameters:
                                validParameters.length > 0 ? validParameters : undefined,
                            preset_parameters:
                                validPresetParameters.length > 0
                                    ? validPresetParameters.map((p) => ({
                                        name: p.name,
                                        type: p.type,
                                        value_template: p.valueTemplate,
                                        required: p.required,
                                    }))
                                    : undefined,
                            timeout_ms: timeoutMs,
                            customMessage: customMessageType === 'text' ? (customMessage || undefined) : undefined,
                            customMessageType,
                            customMessageRecordingId: customMessageType === 'audio' ? (customMessageRecordingId || undefined) : undefined,
                        },
                    },
                };
            }

            const response = await updateToolApiV1ToolsToolUuidPut({
                path: { tool_uuid: toolUuid },
                body: requestBody,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.error) {
                setError(detailFromError(response.error, t("tools.detail.saveError")));
                return;
            }

            if (response.data) {
                setTool(response.data);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
                if (tool.category === "http_api") {
                    setSavedHttpTestSnapshot(
                        buildHttpToolTestSnapshot({
                            name,
                            description,
                            httpMethod,
                            url,
                            credentialUuid,
                            headers,
                            parameters,
                            presetParameters,
                            timeoutMs,
                            customMessage,
                            customMessageType,
                            customMessageRecordingId,
                        })
                    );
                }
            }
        } catch (err) {
            setError(t("tools.detail.saveError"));
            console.error("Error saving tool:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const getCodeSnippet = () => {
        if (!tool) return "";

        const headersObj: Record<string, string> = {
            "Content-Type": "application/json",
        };
        headers.filter((h) => h.key && h.value).forEach((h) => {
            headersObj[h.key] = h.value;
        });

        // Build example body from parameters
        const exampleBody: Record<string, unknown> = {};
        parameters.forEach((p) => {
            if (p.type === "number") {
                exampleBody[p.name] = 0;
            } else if (p.type === "boolean") {
                exampleBody[p.name] = true;
            } else {
                exampleBody[p.name] = `<${p.name}>`;
            }
        });
        presetParameters.forEach((p) => {
            if (p.type === "number") {
                exampleBody[p.name] = p.valueTemplate || 0;
            } else if (p.type === "boolean") {
                exampleBody[p.name] = p.valueTemplate || true;
            } else {
                exampleBody[p.name] = p.valueTemplate || `<${p.name}>`;
            }
        });

        const hasBody =
            httpMethod !== "GET" &&
            httpMethod !== "DELETE" &&
            (parameters.length > 0 || presetParameters.length > 0);

        return `// ${tool.name}
// ${tool.description || "HTTP API Tool"}

const response = await fetch("${url}", {
    method: "${httpMethod}",
    headers: ${JSON.stringify(headersObj, null, 4)},${hasBody ? `
    body: JSON.stringify(${JSON.stringify(exampleBody, null, 4)}),` : ""}
});

const data = await response.json();`;
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-64 w-96" />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (!tool) {
        return (
            <div className="min-h-screen">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-2xl font-bold mb-4">{t("tools.detail.toolNotFound")}</h1>
                        <Button onClick={() => router.push("/tools")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {t("tools.detail.backToTools")}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const isEndCallTool = tool.category === "end_call";
    const isTransferCallTool = tool.category === "transfer_call";
    const isBuiltinTool = tool.category === "calculator";
    const isMcpTool = tool.category === "mcp";
    const isHttpApiTool = tool.category === "http_api";
    const hasUnsavedHttpChanges =
        isHttpApiTool &&
        (savedHttpTestSnapshot === null ||
            buildHttpToolTestSnapshot({
                name,
                description,
                httpMethod,
                url,
                credentialUuid,
                headers,
                parameters,
                presetParameters,
                timeoutMs,
                customMessage,
                customMessageType,
                customMessageRecordingId,
            }) !== savedHttpTestSnapshot);
    const categoryConfig = getCategoryConfig(tool.category as ToolCategory);

    return (
        <div className="min-h-screen">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/tools")}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t("tools.detail.back")}
                            </Button>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{
                                        backgroundColor: tool.icon_color || categoryConfig?.iconColor || "#3B82F6",
                                    }}
                                >
                                    {renderToolIcon(tool.category)}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold">{name}</h1>
                                    <p className="text-sm text-muted-foreground">
                                        {getToolTypeLabel(tool.category, t)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isHttpApiTool && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowCodeDialog(true)}
                                >
                                    <Code className="w-4 h-4 mr-2" />
                                    {t("tools.detail.viewCode")}
                                </Button>
                            )}
                            {TOOL_DOCUMENTATION_URLS[tool.category] && (
                                <a
                                    href={TOOL_DOCUMENTATION_URLS[tool.category]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {t("tools.detail.docs")}
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                    </div>

                    {isBuiltinTool ? (
                        <BuiltinToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            title={t("tools.detail.calculatorTitle")}
                            subtitle={t("tools.detail.calculatorSubtitle")}
                        />
                    ) : isEndCallTool ? (
                        <EndCallToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            messageType={endCallMessageType}
                            onMessageTypeChange={setEndCallMessageType}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            audioRecordingId={audioRecordingId}
                            onAudioRecordingIdChange={setAudioRecordingId}
                            recordings={recordings}
                            endCallReason={endCallReason}
                            onEndCallReasonChange={handleEndCallReasonChange}
                            endCallReasonDescription={endCallReasonDescription}
                            onEndCallReasonDescriptionChange={setEndCallReasonDescription}
                        />
                    ) : isTransferCallTool ? (
                        <TransferCallToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            destinationSource={transferDestinationSource}
                            onDestinationSourceChange={setTransferDestinationSource}
                            destination={transferDestination}
                            onDestinationChange={setTransferDestination}
                            messageType={transferMessageType}
                            onMessageTypeChange={setTransferMessageType}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            audioRecordingId={transferAudioRecordingId}
                            onAudioRecordingIdChange={setTransferAudioRecordingId}
                            recordings={recordings}
                            timeout={transferTimeout}
                            onTimeoutChange={setTransferTimeout}
                            resolverUrl={transferResolverUrl}
                            onResolverUrlChange={setTransferResolverUrl}
                            resolverCredentialUuid={transferResolverCredentialUuid}
                            onResolverCredentialUuidChange={setTransferResolverCredentialUuid}
                            resolverHeaders={transferResolverHeaders}
                            onResolverHeadersChange={setTransferResolverHeaders}
                            resolverTimeoutMs={transferResolverTimeoutMs}
                            onResolverTimeoutMsChange={setTransferResolverTimeoutMs}
                            resolverWaitMessage={transferResolverWaitMessage}
                            onResolverWaitMessageChange={setTransferResolverWaitMessage}
                            parameters={transferParameters}
                            onParametersChange={setTransferParameters}
                            presetParameters={transferPresetParameters}
                            onPresetParametersChange={setTransferPresetParameters}
                        />
                    ) : isMcpTool ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("tools.detail.mcpTitle")}</CardTitle>
                                <CardDescription>
                                    {t("tools.detail.mcpDescription")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="mcp-name">{t("tools.detail.mcpToolName")}</Label>
                                    <Input
                                        id="mcp-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("tools.detail.mcpToolNamePlaceholder")}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mcp-description">{t("tools.detail.mcpDescriptionLabel")}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {t("tools.detail.mcpDescriptionHelp")}
                                    </p>
                                    <Textarea
                                        id="mcp-description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t("tools.detail.mcpDescriptionPlaceholder")}
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mcp-url">{t("tools.detail.mcpUrl")}</Label>
                                    <Input
                                        id="mcp-url"
                                        value={mcpUrl}
                                        onChange={(e) => setMcpUrl(e.target.value)}
                                        placeholder={t("tools.detail.mcpUrlPlaceholder")}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>{t("tools.detail.mcpTransport")}</Label>
                                    <Input
                                        value="Streamable HTTP"
                                        disabled
                                        readOnly
                                    />
                                </div>

                                <CredentialSelector
                                    value={mcpCredentialUuid}
                                    onChange={setMcpCredentialUuid}
                                    label={t("tools.detail.mcpCredential")}
                                    description={t("tools.detail.mcpCredentialDescription")}
                                />

                                <div className="space-y-2">
                                    <Label htmlFor="mcp-tools-filter">{t("tools.detail.mcpToolsFilter")}</Label>
                                    <Input
                                        id="mcp-tools-filter"
                                        value={mcpToolsFilter}
                                        onChange={(e) => setMcpToolsFilter(e.target.value)}
                                        placeholder={t("tools.detail.mcpToolsFilterPlaceholder")}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t("tools.detail.mcpToolsFilterHelp")}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <HttpApiToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            httpMethod={httpMethod}
                            onHttpMethodChange={setHttpMethod}
                            url={url}
                            onUrlChange={setUrl}
                            credentialUuid={credentialUuid}
                            onCredentialUuidChange={setCredentialUuid}
                            headers={headers}
                            onHeadersChange={setHeaders}
                            parameters={parameters}
                            onParametersChange={setParameters}
                            presetParameters={presetParameters}
                            onPresetParametersChange={setPresetParameters}
                            timeoutMs={timeoutMs}
                            onTimeoutMsChange={setTimeoutMs}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            customMessageType={customMessageType}
                            onCustomMessageTypeChange={setCustomMessageType}
                            customMessageRecordingId={customMessageRecordingId}
                            onCustomMessageRecordingIdChange={setCustomMessageRecordingId}
                            recordings={recordings}
                        />
                    )}

                    {isHttpApiTool && (
                        <HttpToolTestDialog
                            open={showTestDialog}
                            onOpenChange={setShowTestDialog}
                            toolUuid={toolUuid}
                            httpMethod={httpMethod}
                            url={url}
                            parameters={parameters}
                            presetParameters={presetParameters}
                        />
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                            {error}
                        </div>
                    )}

                    {saveSuccess && (
                        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
                            {t("tools.detail.savedSuccess")}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                    {isHttpApiTool && (
                        hasUnsavedHttpChanges ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex" tabIndex={0}>
                                        <Button type="button" variant="outline" disabled>
                                            <FlaskConical className="w-4 h-4 mr-2" />
                                            {t("tools.detail.testTool")}
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    {t("tools.detail.saveBeforeTest")}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowTestDialog(true)}
                                disabled={isSaving}
                            >
                                <FlaskConical className="w-4 h-4 mr-2" />
                                {t("tools.detail.testTool")}
                            </Button>
                        )
                    )}
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t("common.saving")}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {t("common.save")}
                            </>
                        )}
                    </Button>
                    </div>
                </div>
            </div>

            {/* Code View Dialog (only for HTTP API tools) */}
            <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("tools.detail.codePreview")}</DialogTitle>
                        <DialogDescription>
                            {t("tools.detail.codePreviewDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
                        <pre>{getCodeSnippet()}</pre>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
