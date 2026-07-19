"use client";

import Link from 'next/link';

import { GitHubStarBadge } from '@/components/layout/GitHubStarBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n/LocaleContext';

export default function OverviewPage() {
    const { t } = useTranslation();
    const { user, provider } = useAuth();
    const isOSSMode = provider !== 'stack';

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Welcome Card */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-3xl">
                            {isOSSMode ? (
                                t('overview.welcomeOSS')
                            ) : (
                                user?.displayName
                                    ? `${t('overview.welcome')}, ${user.displayName.split(' ')[0]}!`
                                    : `${t('overview.welcome')}!`
                            )}
                        </CardTitle>
                        <CardDescription className="text-lg mt-2">
                            {isOSSMode ? (
                                t('overview.welcomeDescriptionOSS')
                            ) : (
                                t('overview.welcomeDescriptionCloud')
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isOSSMode && (
                            <div className="mb-6">
                                <GitHubStarBadge label={t('overview.starOnGitHub')} showCount source="overview_page" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('overview.agentsTitle')}</CardTitle>
                            <CardDescription>
                                {t('overview.agentsDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link href="/workflow">
                                    {t('overview.agentsAction')}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('overview.servicesTitle')}</CardTitle>
                            <CardDescription>
                                {t('overview.servicesDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline">
                                <Link href="/model-configurations">
                                    {t('overview.servicesAction')}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Resources Section */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>{t('overview.resourcesTitle')}</CardTitle>
                        <CardDescription>
                            {t('overview.resourcesDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <Button asChild variant="outline">
                                <a
                                    href="https://docs.dograh.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('overview.resourcesDocumentation')}
                                </a>
                            </Button>
                            <Button asChild variant="outline">
                                <a
                                    href="https://github.com/dograh-hq/dograh/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('overview.resourcesReportIssue')}
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
