'use client';

import { Suspense, useEffect, useState, useRef } from 'react';

import { getWorkflowsApiV1WorkflowFetchGet, listFoldersApiV1FolderGet } from '@/client/sdk.gen';
import type { FolderResponse, WorkflowListResponse } from '@/client/types.gen';
import { Card, CardContent } from '@/components/ui/card';
import { CreateWorkflowButton } from "@/components/workflow/CreateWorkflowButton";
import { AgentFolderView } from '@/components/workflow/folders/AgentFolderView';
import { CreateFolderButton } from '@/components/workflow/folders/CreateFolderButton';
import { FolderSection } from '@/components/workflow/folders/FolderSection';
import { UploadWorkflowButton } from '@/components/workflow/UploadWorkflowButton';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { useTranslation } from '@/lib/i18n/LocaleContext';

import WorkflowLayout from "./WorkflowLayout";

function WorkflowsLoading() {
    const { t } = useTranslation();
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-12">
                <div className="h-8 w-48 bg-muted rounded mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }, (_, i) => (
                        <Card key={i}>
                            <CardContent className="p-0">
                                <div className="h-40 bg-muted/70" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="h-8 w-48 bg-muted rounded"></div>
                    <div className="h-10 w-32 bg-muted rounded"></div>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <div className="h-96 bg-muted/70" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function WorkflowContent() {
    const { t } = useTranslation();
    const { user, getAccessToken, loading: authLoading } = useAuth();
    const hasFetched = useRef(false);
    const [activeWorkflows, setActiveWorkflows] = useState<WorkflowListResponse[]>([]);
    const [archivedWorkflows, setArchivedWorkflows] = useState<WorkflowListResponse[]>([]);
    const [folders, setFolders] = useState<FolderResponse[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        if (authLoading || !user || hasFetched.current) return;
        hasFetched.current = true;

        const fetchData = async () => {
            try {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    setAuthError(true);
                    return;
                }

                const response = await getWorkflowsApiV1WorkflowFetchGet({
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    query: {
                        status: 'active,archived'
                    }
                });

                const allWorkflowData = response.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];

                const active = allWorkflowData
                    .filter((w: WorkflowListResponse) => w.status === 'active')
                    .sort((a: WorkflowListResponse, b: WorkflowListResponse) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                const archived = allWorkflowData
                    .filter((w: WorkflowListResponse) => w.status === 'archived')
                    .sort((a: WorkflowListResponse, b: WorkflowListResponse) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setActiveWorkflows(active);
                setArchivedWorkflows(archived);

                try {
                    const foldersResponse = await listFoldersApiV1FolderGet({
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });
                    setFolders(foldersResponse.data ?? []);
                } catch (folderErr) {
                    logger.error(`Error fetching folders: ${folderErr}`);
                }
            } catch (err) {
                logger.error(`Error fetching workflows: ${err}`);
                setError(t('workflow.list.loadError'));
            }
        };

        fetchData();
    }, [authLoading, user, getAccessToken, t]);

    if (authError) {
        return (
            <div className="text-red-500">
                {t('workflow.list.authRequired')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t('workflow.list.title')}</h1>
                    <div className="flex gap-2">
                        <UploadWorkflowButton />
                        <CreateFolderButton />
                        <CreateWorkflowButton />
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">{t('workflow.list.activeAgents')}</h2>
                    {activeWorkflows.length > 0 || folders.length > 0 ? (
                        <AgentFolderView workflows={activeWorkflows} folders={folders} />
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                {t('workflow.list.noWorkflows')}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {archivedWorkflows.length > 0 && (
                    <div className="mb-8">
                        <FolderSection kind="archived" workflows={archivedWorkflows} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WorkflowPage() {
    return (
        <WorkflowLayout showFeaturesNav={true}>
            <Suspense fallback={<WorkflowsLoading />}>
                <WorkflowContent />
            </Suspense>
        </WorkflowLayout>
    );
}
