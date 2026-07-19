"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createPhoneNumberApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPost,
} from "@/client/sdk.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface WhatsAppSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configId: number;
  bridgeUrl: string;
  onSaved: () => void;
}

type SessionState = "idle" | "creating" | "waiting_qr" | "scanning" | "paired" | "error";

interface WaSession {
  id: string;
  name: string;
  jid: string;
  state: string;
  paired: boolean;
}

export function WhatsAppSessionDialog({
  open,
  onOpenChange,
  configId,
  bridgeUrl,
  onSaved,
}: WhatsAppSessionDialogProps) {
  const { getAccessToken } = useAuth();
  const { t } = useTranslation();
  const [sessionName, setSessionName] = useState("");
  const [state, setState] = useState<SessionState>("idle");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setState("idle");
      setQrData(null);
      setSessionId(null);
      setSessionName("");
      setError(null);
    }
  }, [open]);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startPairing = async () => {
    setState("creating");
    setError(null);

    try {
      // Create a new session on the bridge
      const res = await fetch(`${bridgeUrl}/api/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to create session: ${res.statusText}`);
      }

      const data = await res.json();
      const newSessionId = data.id;
      setSessionId(newSessionId);

      // Connect to SSE events on the bridge to receive QR code
      setState("waiting_qr");
      connectToSSE(newSessionId);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  };

  const connectToSSE = (sid: string) => {
    cleanup();

    // Connect to SSE events via bridge
    const sseUrl = `${bridgeUrl}/api/v1/sessions/${sid}/events`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data, sid);
      } catch (e) {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // Fallback to polling if SSE fails
      startPolling(sid);
    };
  };

  const handleSSEEvent = (data: any, targetSessionId: string) => {
    if (data.type === "session-qr" && data.sessionId === targetSessionId) {
      setQrData(data.qr);
      setState("waiting_qr");
    } else if (data.type === "auth-state" && data.sessionId === targetSessionId) {
      if (data.paired) {
        setState("paired");
        handlePairingComplete();
      }
    }
  };

  const startPolling = (sid: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const qrRes = await fetch(`${bridgeUrl}/api/v1/sessions/${sid}/qr`);
        if (qrRes.ok) {
          const result = await qrRes.json();
          if (result.paired) {
            setState("paired");
            handlePairingComplete();
            return;
          }
          if (result.qr) {
            setQrData(result.qr);
            setState("waiting_qr");
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 2000);
  };

  const handlePairingComplete = async () => {
    cleanup();

    if (!sessionId) return;

    try {
      const token = await getAccessToken();
      // Get the session info to retrieve the WhatsApp number
      const res = await fetch(`${bridgeUrl}/api/v1/sessions`);
      if (!res.ok) throw new Error("Failed to fetch session info");

      const data = await res.json();
      const session = data.sessions?.find((s: WaSession) => s.id === sessionId);

      if (!session?.jid) {
        throw new Error("Session not fully paired yet");
      }

      // Extract phone number from JID (format: <number>@s.whatsapp.net)
      const phoneNumber = session.jid.split("@")[0];

      // Create a phone number entry in Dograh
      const phoneRes = await createPhoneNumberApiV1OrganizationsTelephonyConfigsConfigIdPhoneNumbersPost({
        headers: { Authorization: `Bearer ${token}` },
        path: { config_id: configId },
        body: {
          address: `+${phoneNumber}`,
          country_code: phoneNumber.substring(0, 2),
          label: sessionName || `WhatsApp ${phoneNumber}`,
          is_active: true,
          is_default_caller_id: false,
        },
      });

      if (phoneRes.error) {
        throw new Error("Failed to register phone number");
      }

      toast.success(t('telephony.wacalls.pairedToast'));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete setup");
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to complete setup");
    }
  };

  const getQRCodeImage = (qrString: string) => {
    // Generate QR code using external API (or use a library)
    return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrString)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('telephony.wacalls.addSession')}</DialogTitle>
          <DialogDescription>
            {t('telephony.wacalls.scanInstructions')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {state === "idle" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="session-name">{t('telephony.wacalls.sessionNameLabel')}</Label>
                <Input
                  id="session-name"
                  placeholder="e.g. Support Line"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('telephony.wacalls.scanInstructions')}
              </p>
            </>
          )}

          {state === "creating" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">{t('telephony.wacalls.creatingSession')}</p>
            </div>
          )}

          {(state === "waiting_qr" || state === "scanning") && (
            <div className="flex flex-col items-center justify-center py-4">
              {qrData ? (
                <>
                  <img
                    src={getQRCodeImage(qrData)}
                    alt="QR Code"
                    className="w-64 h-64 border rounded-lg"
                  />
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    {t('telephony.wacalls.qrInstructions')}
                  </p>
                </>
              ) : (
                <>
                  <div className="animate-pulse bg-muted w-64 h-64 rounded-lg"></div>
                  <p className="mt-4 text-sm text-muted-foreground">{t('telephony.wacalls.waitingQR')}</p>
                </>
              )}
            </div>
          )}

          {state === "paired" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-green-100 p-3">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium">{t('telephony.wacalls.pairedSuccess')}</p>
              <p className="text-xs text-muted-foreground">{t('telephony.wacalls.setupPhoneNumber')}</p>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={startPairing} className="w-full">
                {t('common.retry')}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={state === "creating"}>
            {t('common.cancel')}
          </Button>
          {state === "idle" && (
            <Button onClick={startPairing}>{t('telephony.wacalls.startPairing')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
