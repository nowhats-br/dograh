"use client";

import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  deletePhoneNumberApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPhoneNumberIdDelete,
  getTelephonyConfigurationByIdApiV1OrganizationsTelephonyConfigsConfigIdGet,
  listPhoneNumbersApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersGet,
  setDefaultCallerIdApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPhoneNumberIdSetDefaultCallerPost,
  setDefaultOutboundApiV1OrganizationsTelephonyConfigsConfigIdSetDefaultOutboundPost,
} from "@/client/sdk.gen";
import type {
  PhoneNumberResponse,
  TelephonyConfigurationDetail,
} from "@/client/types.gen";
import { ConfigFormDialog } from "@/components/telephony/ConfigFormDialog";
import { PhoneNumberDialog } from "@/components/telephony/PhoneNumberDialog";
import { WhatsAppSessionDialog } from "@/components/telephony/WhatsAppSessionDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppConfig } from "@/context/AppConfigContext";
import { detailFromError } from "@/lib/apiError";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useAuth } from "@/lib/auth";
import { resolveWebhookBaseUrl } from "@/lib/webhookUrl";

const INBOUND_WEBHOOK_PATH = "/api/v1/telephony/inbound/run";

export default function TelephonyConfigurationDetailPage() {
  const router = useRouter();
  const params = useParams<{ configId: string }>();
  const configId = Number(params.configId);

  const { user, getAccessToken, loading: authLoading } = useAuth();
  const { config: appConfig } = useAppConfig();
  const inboundWebhookUrl = `${resolveWebhookBaseUrl(appConfig?.tunnelUrl)}${INBOUND_WEBHOOK_PATH}`;
  const [config, setConfig] = useState<TelephonyConfigurationDetail | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editConfigOpen, setEditConfigOpen] = useState(false);

  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneEditTarget, setPhoneEditTarget] = useState<PhoneNumberResponse | null>(
    null,
  );
  const [phoneDeleteTarget, setPhoneDeleteTarget] = useState<PhoneNumberResponse | null>(
    null,
  );
  const [waSessionDialogOpen, setWaSessionDialogOpen] = useState(false);

  const { t } = useTranslation();

  const fetchAll = useCallback(async () => {
    if (authLoading || !user || !configId) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const [cfgRes, numbersRes] = await Promise.all([
        getTelephonyConfigurationByIdApiV1OrganizationsTelephonyConfigsConfigIdGet({
          headers: { Authorization: `Bearer ${token}` },
          path: { config_id: configId },
        }),
        listPhoneNumbersApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersGet({
          headers: { Authorization: `Bearer ${token}` },
          path: { config_id: configId },
        }),
      ]);

      if (cfgRes.error) throw new Error(detailFromError(cfgRes.error));
      if (numbersRes.error) throw new Error(detailFromError(numbersRes.error));

      setConfig(cfgRes.data ?? null);
      setPhoneNumbers(numbersRes.data?.phone_numbers ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("telephony.configDetail.loadError"));
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, configId, getAccessToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onSetDefaultOutbound = async () => {
    if (!config) return;
    try {
      const token = await getAccessToken();
      const res = await setDefaultOutboundApiV1OrganizationsTelephonyConfigsConfigIdSetDefaultOutboundPost(
        {
          headers: { Authorization: `Bearer ${token}` },
          path: { config_id: config.id },
        },
      );
      if (res.error) throw new Error(detailFromError(res.error));
      toast.success(t("telephony.configDetail.setDefaultOutboundSuccess"));
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("telephony.configDetail.setDefaultOutboundError"));
    }
  };

  const onSetDefaultCaller = async (n: PhoneNumberResponse) => {
    try {
      const token = await getAccessToken();
      const res = await setDefaultCallerIdApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPhoneNumberIdSetDefaultCallerPost(
        {
          headers: { Authorization: `Bearer ${token}` },
          path: { config_id: configId, phone_number_id: n.id },
        },
      );
      if (res.error) throw new Error(detailFromError(res.error));
      toast.success(t("telephony.configDetail.setDefaultCallerSuccess", { address: n.address }));
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("telephony.configDetail.setDefaultCallerError"));
    }
  };

  const onConfirmDeletePhone = async () => {
    if (!phoneDeleteTarget) return;
    try {
      const token = await getAccessToken();
      const res = await deletePhoneNumberApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPhoneNumberIdDelete(
        {
          headers: { Authorization: `Bearer ${token}` },
          path: {
            config_id: configId,
            phone_number_id: phoneDeleteTarget.id,
          },
        },
      );
      if (res.error) throw new Error(detailFromError(res.error));
      toast.success(t("telephony.configDetail.phoneDeleted"));
      setPhoneDeleteTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("telephony.configDetail.phoneDeleteError"));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push("/telephony-configurations")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("common.back")}
        </Button>
        <p className="mt-4 text-muted-foreground">{t("telephony.configDetail.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href="/telephony-configurations"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("telephony.configDetail.allConfigsLink")}
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="truncate">{config.name}</CardTitle>
              <Badge variant="secondary">{config.provider}</Badge>
              {config.is_default_outbound && (
                  <Badge className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    {t("telephony.configDetail.defaultBadge")}
                  </Badge>
              )}
            </div>
            <CardDescription>
              {t("telephony.configDetail.updatedPrefix")}{new Date(config.updated_at).toLocaleString()}
            </CardDescription>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(String(config.id))
                  .then(() => toast.success(t("telephony.configDetail.idCopied")))
                  .catch(() => toast.error(t("telephony.configDetail.idCopyFailed")));
              }}
              title={t("common.clickToCopy")}
              className="inline-flex items-center gap-1 self-start rounded font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{t("telephony.configDetail.idLabel")}{config.id}</span>
              <Copy className="h-3 w-3 shrink-0" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!config.is_default_outbound && (
              <Button variant="outline" size="sm" onClick={onSetDefaultOutbound}>
                <Star className="h-4 w-4 mr-2" /> {t("telephony.configDetail.setDefaultButton")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditConfigOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> {t("telephony.configDetail.editCredentials")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(config.credentials ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono text-right truncate max-w-[60%]">
                  {String(v ?? "")}
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("telephony.configDetail.inboundWebhookLabel")}</p>
            <button
              type="button"
              onClick={() => {
                const url = inboundWebhookUrl;
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success(t("telephony.configDetail.webhookUrlCopied")))
                  .catch(() => toast.error(t("telephony.configDetail.webhookUrlCopyFailed")));
              }}
              title={t("telephony.configDetail.copyWebhookTitle")}
              aria-label={t("telephony.configDetail.copyWebhookAria")}
              className="inline-flex items-center gap-1 self-start rounded font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{inboundWebhookUrl}</span>
              <Copy className="h-3 w-3 shrink-0" />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>
              {config.provider === "wacalls" ? t("telephony.configDetail.whatsappSessionsTitle") : t("telephony.configDetail.phoneNumbersTitle")}
            </CardTitle>
            <CardDescription>
              {config.provider === "wacalls"
                ? t("telephony.configDetail.whatsappDescription")
                : t("telephony.configDetail.phoneNumbersDescription")}
              {config.provider !== "wacalls" && (
                <a
                  href="https://docs.dograh.com/integrations/telephony/inbound"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  {t("telephony.configDetail.inboundDocsLink")} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardDescription>
          </div>
          {config.provider === "wacalls" ? (
            <Button size="sm" onClick={() => setWaSessionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t("telephony.configDetail.addWhatsAppSession")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setPhoneEditTarget(null);
                setPhoneDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("telephony.configDetail.addPhoneNumber")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {phoneNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("telephony.configDetail.noNumbers")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("telephony.configDetail.table.address")}</TableHead>
                  <TableHead>{t("telephony.configDetail.table.type")}</TableHead>
                  <TableHead>{t("telephony.configDetail.table.label")}</TableHead>
                  <TableHead>{t("telephony.configDetail.table.status")}</TableHead>
                  <TableHead>{t("telephony.configDetail.table.inboundWorkflow")}</TableHead>
                  <TableHead className="text-right">{t("telephony.configDetail.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono">{n.address}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{n.address_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {n.label ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {n.is_active ? (
                          <Badge variant="secondary">{t("telephony.configDetail.activeBadge")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("telephony.configDetail.inactiveBadge")}</Badge>
                        )}
                        {n.is_default_caller_id && (
                          <Badge className="gap-1">
                            <Star className="h-3 w-3 fill-current" /> {t("telephony.configDetail.defaultCallerBadge")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {n.inbound_workflow_id ? (
                        <Link
                          href={`/workflow/${n.inbound_workflow_id}`}
                          className="inline-flex items-center gap-1 hover:underline hover:text-foreground"
                        >
                          <span>{t("telephony.configDetail.workflowIdPrefix")}{n.inbound_workflow_id}</span>
                          {n.inbound_workflow_name && (
                            <span
                              className="truncate max-w-[160px]"
                              title={n.inbound_workflow_name}
                            >
                              {n.inbound_workflow_name.length > 24
                                ? `${n.inbound_workflow_name.slice(0, 24)}…`
                                : n.inbound_workflow_name}
                            </span>
                          )}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!n.is_default_caller_id && n.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetDefaultCaller(n)}
                            title={t("telephony.configDetail.setDefaultCallerTitle")}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPhoneEditTarget(n);
                            setPhoneDialogOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhoneDeleteTarget(n)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfigFormDialog
        open={editConfigOpen}
        onOpenChange={setEditConfigOpen}
        existing={config}
        onSaved={fetchAll}
      />

      <PhoneNumberDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        configId={configId}
        existing={phoneEditTarget}
        onSaved={fetchAll}
      />

      {config.provider === "wacalls" && (
        <WhatsAppSessionDialog
          open={waSessionDialogOpen}
          onOpenChange={setWaSessionDialogOpen}
          configId={configId}
          onSaved={fetchAll}
        />
      )}

      <AlertDialog
        open={!!phoneDeleteTarget}
        onOpenChange={(o) => !o && setPhoneDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("telephony.configDetail.deletePhoneConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("telephony.configDetail.deletePhoneConfirmDescription", { address: phoneDeleteTarget?.address })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDeletePhone}>{t("common.deleteConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
