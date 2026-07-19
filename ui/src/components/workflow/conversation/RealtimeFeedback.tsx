"use client";

import {
    conversationItemsFromLiveFeedback,
    conversationItemsFromRealtimeFeedbackEvents,
} from "./adapters/fromRealtimeFeedback";
import { ConversationContainer } from "./ConversationContainer";
import { ConversationTimeline } from "./ConversationTimeline";
import type {
    ConversationStatus,
    RealtimeFeedbackMessage,
    WorkflowRunLogs,
} from "./types";
import { countConversationMessages } from "./utils";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface LiveModeProps {
    mode: "live";
    messages: RealtimeFeedbackMessage[];
    isCallActive: boolean;
    isCallCompleted: boolean;
}

interface HistoricalModeProps {
    mode: "historical";
    logs: WorkflowRunLogs | null;
}

type RealtimeFeedbackProps = LiveModeProps | HistoricalModeProps;

export function RealtimeFeedback(props: RealtimeFeedbackProps) {
    const { t } = useTranslation();
    let items;
    let status: ConversationStatus;
    let title: string;
    let emptyState: { title: string; subtitle: string };
    let autoScroll = false;

    if (props.mode === "historical") {
        items = props.logs?.realtime_feedback_events
            ? conversationItemsFromRealtimeFeedbackEvents(props.logs.realtime_feedback_events)
            : [];
        status = "ended";
        title = t('workflow.conversation.realtimeFeedback.callTranscript');
        emptyState = {
            title: t('workflow.conversation.realtimeFeedback.noConversation'),
            subtitle: t('workflow.conversation.realtimeFeedback.noConversationSubtitle'),
        };
    } else {
        items = conversationItemsFromLiveFeedback(props.messages);
        status = props.isCallActive ? "live" : props.isCallCompleted ? "ended" : "ready";
        title = t('workflow.conversation.realtimeFeedback.liveTranscript');
        emptyState = {
            title: t('workflow.conversation.realtimeFeedback.noMessages'),
            subtitle: props.isCallActive
                ? t('workflow.conversation.realtimeFeedback.noMessagesActive')
                : t('workflow.conversation.realtimeFeedback.noMessagesReady'),
        };
        autoScroll = true;
    }

    return (
        <ConversationContainer
            title={title}
            status={status}
            messageCount={countConversationMessages(items) || undefined}
        >
            <ConversationTimeline
                items={items}
                autoScroll={autoScroll}
                emptyState={emptyState}
            />
        </ConversationContainer>
    );
}
