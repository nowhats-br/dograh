'use client';

import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createFolderApiV1FolderPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';

import { FolderFormDialog } from './FolderFormDialog';
import { useTranslation } from '@/lib/i18n/LocaleContext';

export function CreateFolderButton() {
    const { t } = useTranslation();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const handleCreate = async (name: string) => {
        const response = await createFolderApiV1FolderPost({ body: { name } });
        if (response.error) {
            const detail =
                (response.error as { detail?: string })?.detail ??
                t('workflow.folders.createFolderButton.failedToCreate');
            toast.error(detail);
            throw new Error(detail);
        }
        toast.success(t('workflow.folders.createFolderButton.folderCreated', { name }));
        router.refresh();
    };

    return (
        <>
            <Button variant="outline" onClick={() => setIsOpen(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                {t('workflow.folders.createFolderButton.newFolder')}
            </Button>
            <FolderFormDialog
                open={isOpen}
                onOpenChange={setIsOpen}
                title={t('workflow.folders.createFolderButton.createFolder')}
                submitLabel={t('workflow.folders.createFolderButton.create')}
                onSubmit={handleCreate}
            />
        </>
    );
}
