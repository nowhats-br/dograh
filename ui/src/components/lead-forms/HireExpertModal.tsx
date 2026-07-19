"use client";

import Cal from "@calcom/embed-react";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAuth } from "@/lib/auth";

import { CaptchaChallenge } from "./CaptchaChallenge";
import { FormTrustLine } from "./FormTrustLine";
import { isValidEmail } from "./isPersonalEmail";
import { HIRE_VOLUME_OPTIONS, type LeadSource } from "./leadFieldOptions";
import { LeadModalShell } from "./LeadModalShell";
import { PhoneField } from "./PhoneField";
import { submitLead } from "./submitLead";

interface HireExpertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: LeadSource;
  onOpenEnterprise: () => void;
}

export function HireExpertModal({ open, onOpenChange, source, onOpenEnterprise }: HireExpertModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();  // logged-in identity (prefills the email field)
  const { config } = useAppConfig();
  // Deployment provenance (analytics only): cloud → cloud_app, else oss_app. OSS submits the
  // lead anonymously (cloud can't verify its token), so the email field below is the identity.
  const origin = config?.deploymentMode === "cloud" ? "cloud_app" : "oss_app";
  // Logged-in user's email (Stack uses primaryEmail; local uses email) — prefilled, editable.
  const userEmail = user ? ("primaryEmail" in user ? user.primaryEmail ?? "" : user.email ?? "") : "";

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agentGoal, setAgentGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [volume, setVolume] = useState("");
  const [captchaActive, setCaptchaActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Cal.com booking link from the server's response (the server decides; the app only renders).
  const [calLink, setCalLink] = useState<string | null>(null);

  // Prefill the email from the logged-in user when the modal opens (don't clobber edits).
  useEffect(() => {
    if (open && userEmail) setEmail((e) => e || userEmail);
  }, [open, userEmail]);

  const reset = () => {
    setName(""); setCompany(""); setEmail(""); setJobTitle(""); setAgentGoal("");
    setPhone(""); setVolume(""); setCaptchaActive(false); setSubmitting(false);
    setCalLink(null);
  };

  // Required fields, independent of the anti-spam check (which is revealed only
  // after the first submit click — see handleSubmit).
  const baseValid =
    Boolean(name.trim()) &&
    Boolean(company.trim()) &&
    isValidEmail(email) &&
    Boolean(jobTitle.trim()) &&
    Boolean(agentGoal.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(volume);

  const canSubmit = baseValid && !submitting;

  // Validate, then pop the anti-spam check on top of the modal.
  const handleSubmit = () => {
    if (!baseValid) {
      toast.error(t("leadForms.hireExpert.toastRequiredFields"));
      return;
    }
    setCaptchaActive(true);
  };

  // Runs once the captcha popup is verified.
  const doSubmit = async () => {
    setCaptchaActive(false);
    setSubmitting(true);
    try {
      const result = await submitLead({
        kind: "hire_expert",
        source,
        origin,
        payload: { name, company, email, jobTitle, agentGoal, phone, volume },
      });
      // The server decides whether to return a booking link; if it does, show the calendar
      // inline, else the email note. The app only reads the response — no logic of its own.
      if (result?.show_calendar && result.cal_link) {
        setSubmitting(false);
        setCalLink(result.cal_link);
      } else {
        toast.success(t("leadForms.hireExpert.toastCheckInbox"));
        reset();
        onOpenChange(false);
      }
    } catch {
      toast.error(t("leadForms.hireExpert.toastError"));
      setSubmitting(false);
    }
  };

  // Booking state: the server returned a booking link — show the inline calendar in the modal.
  if (calLink) {
    return (
      <LeadModalShell
        open={open}
        onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
        icon={Sparkles}
        eyebrow={t("leadForms.hireExpert.eyebrow")}
        title={t("leadForms.hireExpert.titleCalendar")}
        description={t("leadForms.hireExpert.descriptionCalendar")}
        primary={{ label: t("leadForms.hireExpert.primaryDone"), onClick: () => { reset(); onOpenChange(false); } }}
      >
        {/* Compact, zoomed-out calendar: render it larger, scale to 0.8, and clip the layout box left behind. */}
        <div className="overflow-hidden" style={{ height: "440px" }}>
          <Cal
            calLink={calLink}
            config={{ layout: "month_view", name, email }}
            style={{ width: "113.64%", height: "500px", overflow: "auto", transform: "scale(0.88)", transformOrigin: "top left" }}
          />
        </div>
      </LeadModalShell>
    );
  }

  return (
    <LeadModalShell
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      icon={Sparkles}
      eyebrow={t("leadForms.hireExpert.eyebrow")}
      title={t("leadForms.hireExpert.titleForm")}
      description={t("leadForms.hireExpert.descriptionForm")}
      primary={{ label: t("leadForms.hireExpert.primarySubmit"), onClick: handleSubmit, disabled: !canSubmit, loading: submitting }}
      secondary={{ label: t("leadForms.hireExpert.secondaryCancel"), onClick: () => onOpenChange(false), disabled: submitting }}
      helper={
        <button
          type="button"
          onClick={onOpenEnterprise}
          className="underline decoration-dashed underline-offset-4 hover:text-foreground"
        >
          {t("leadForms.hireExpert.helperEnterpriseLink")}
        </button>
      }
      trustLine={<FormTrustLine />}
      overlay={captchaActive ? <CaptchaChallenge onVerified={doSubmit} onCancel={() => setCaptchaActive(false)} /> : undefined}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hire-name">{t("leadForms.hireExpert.labelName")}</Label>
            <Input id="hire-name" placeholder={t("leadForms.hireExpert.placeholderName")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-company">{t("leadForms.hireExpert.labelCompany")}</Label>
            <Input id="hire-company" placeholder={t("leadForms.hireExpert.placeholderCompany")} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-email">{t("leadForms.hireExpert.labelEmail")}</Label>
          <Input id="hire-email" type="email" placeholder={t("leadForms.hireExpert.placeholderEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-title">{t("leadForms.hireExpert.labelJobTitle")}</Label>
          <Input id="hire-title" placeholder={t("leadForms.hireExpert.placeholderJobTitle")} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hire-goal">{t("leadForms.hireExpert.labelGoal")}</Label>
          <Textarea
            id="hire-goal"
            value={agentGoal}
            onChange={(e) => setAgentGoal(e.target.value)}
            placeholder={t("leadForms.hireExpert.placeholderGoal")}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hire-phone">{t("leadForms.hireExpert.labelPhone")}</Label>
            <PhoneField id="hire-phone" value={phone} onChange={setPhone} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-volume">{t("leadForms.hireExpert.labelVolume")}</Label>
            <Select value={volume} onValueChange={setVolume}>
              <SelectTrigger id="hire-volume"><SelectValue placeholder={t("leadForms.hireExpert.placeholderSelect")} /></SelectTrigger>
              <SelectContent>
                {HIRE_VOLUME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>
    </LeadModalShell>
  );
}
