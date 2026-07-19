"use client";

import { MessageSquare, Mic, MicOff } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/LocaleContext";

import type { ConversationStatus } from "./types";

interface ConversationContainerProps {
    title: string;
    status: ConversationStatus;
    children: ReactNode;
    messageCount?: number;
}

export function ConversationContainer({
    title,
    status,
    children,
    messageCount,
}: ConversationContainerProps) {
    const { t } = useTranslation();

    const STATUS_CONFIG = {
        ready: {
            icon: MicOff,
            label: t("workflow.conversation.container.statusReady"),
            className: "bg-muted text-muted-foreground",
        },
        live: {
            icon: Mic,
            label: t("workflow.conversation.container.statusLive"),
            className: "bg-green-500/10 text-green-600 dark:text-green-400",
        },
        ended: {
            icon: MicOff,
            label: t("workflow.conversation.container.statusEnded"),
            className: "bg-muted text-muted-foreground",
        },
    } satisfies Record<ConversationStatus, { icon: typeof Mic; label: string; className: string }>;

    const statusConfig = STATUS_CONFIG[status];
    const StatusIcon = statusConfig.icon;

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-background">
            <div className="shrink-0 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate whitespace-nowrap text-sm font-medium">{title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {messageCount !== undefined && messageCount > 0 ? (
                            <span className="text-xs text-muted-foreground">{t("workflow.conversation.container.messageCount", { count: messageCount })}</span>
                        ) : null}
                        <div
                            className={cn(
                                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                                statusConfig.className,
                            )}
                        >
                            <StatusIcon className="h-3 w-3" />
                            <span>{statusConfig.label}</span>
                        </div>
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}
