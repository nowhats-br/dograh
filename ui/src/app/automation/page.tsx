"use client";

import { Zap } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/LocaleContext';

export default function AutomationPage() {
    const { t } = useTranslation();
    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">{t('automation.title')}</h1>
                <p>{t('automation.description')}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('automation.comingSoon')}</CardTitle>
                    <CardDescription>
                        {t('automation.comingSoonDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <Zap className="w-16 h-16 mx-auto mb-6" />
                        <p className="text-lg mb-4">
                            {t('automation.workingOn')}
                        </p>
                        <p>
                            {t('automation.featureList')}
                        </p>
                        <p className="mt-4">
                            {t('automation.checkBack')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
