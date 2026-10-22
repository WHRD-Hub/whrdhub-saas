"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye, EyeOff, Shield, AlertCircle, Link as LinkIcon,
  Check, MapPin, Upload, X, Loader2, Image as ImageIcon, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { submitReport, type ReportData } from "@/app/actions/report-submit";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { uploadReportScreenshots } from "@/lib/supabase/storage";
import { enqueueReport, requestBackgroundSync } from "@/lib/offline/report-queue";
import { QUEUE_CHANGED_EVENT } from "@/components/pwa/offline-sync-manager";
import { CopyButton } from "@/components/reporting/copy-button";
import { toast } from "@/components/ui/toast";
import { useLanguage, useT } from "@/lib/i18n/context";
import { translations } from "@/lib/i18n/translations";
import { INCIDENT_TYPES, ONLINE_INCIDENT_TYPES, SUPPORT_TYPES, KENYA_COUNTIES, OTHER_COUNTRIES, countryOf } from "@/lib/reporting-options";
import { URGENCY_META } from "@/lib/urgency";
import { VoiceInput } from "@/components/reporting/voice-input";
import { useOnline } from "@/lib/use-online";
import { uploadReportVoiceNote } from "@/lib/supabase/storage";
import { attachVoiceNote, attachScreenshots } from "@/app/actions/report-update";
import { previewSharedPost } from "@/app/actions/share";
import { readShared, clearShared, firstUrl, platformFromUrl, type SharedItem } from "@/lib/shared-intake";

// ─── dual-language label helper ──────────────────────────────────────────────
// When isDualLang is true (EN or SW), show primary label + secondary in parentheses.
function DL({ primary, secondary, isDual }: { primary: string; secondary: string; isDual: boolean }) {
  if (!isDual) return <span>{primary}</span>;
  return (
    <span>
      {primary}{" "}
      <span className="text-muted font-normal text-xs">({secondary})</span>
    </span>
  );
}

// ─── pill toggle ─────────────────────────────────────────────────────────────
function Pill({
  selected, onClick, children, danger,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium select-none
        transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out
        active:scale-[0.97] hover:border-purple/40 hover:bg-purple-050/60
        ${selected
          ? danger
            ? "bg-rose-600 text-white border-rose-600 shadow-sm"
            : "bg-purple text-white border-purple shadow-sm hover:bg-purple hover:border-purple"
          : "bg-surface border-line text-ink"
        }`}
      style={{ willChange: "transform" }}
    >
      {selected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

// ─── card ────────────────────────────────────────────────────────────────────
function Card({ title, subtitle, children }: {
  title?: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="card-premium rise p-5 sm:p-7 md:p-9 space-y-5 sm:space-y-6">
      {title && (
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted leading-relaxed">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── field wrapper ────────────────────────────────────────────────────────────
let _fieldId = 0;
function Field({ label, hint, required, error, children, id: idProp }: {
  label?: React.ReactNode; hint?: string; required?: boolean;
  error?: string; children: React.ReactNode; id?: string;
}) {
  const id = idProp ?? `field-${++_fieldId}`;
  const errorId = `${id}-error`;
  const hintId  = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-semibold text-ink">
          {label}
          {required && <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}
      {/* Clone child to inject id + aria props */}
      {children}
      {error
        ? <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <span aria-hidden="true">⚠</span>{error}
          </p>
        : hint && <p id={hintId} className="text-xs text-muted">{hint}</p>
      }
    </div>
  );
}

// ─── select ──────────────────────────────────────────────────────────────────
function Select({ value, onChange, children, placeholder, hasError, id, describedBy }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; placeholder?: string; hasError?: boolean;
  id?: string; describedBy?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={describedBy}
        className={`w-full appearance-none rounded-xl border bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 pr-9
          ${hasError ? "border-rose-600 focus:ring-rose-600/30" : "border-line focus:ring-purple"}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
    </div>
  );
}

function toggle(arr: string[], val: string, set: (v: string[]) => void) {
  set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
}

// ─── data ─────────────────────────────────────────────────────────────────────
const PLATFORMS = [
  "Facebook", "Twitter / X", "Instagram", "WhatsApp", "TikTok",
  "YouTube", "Telegram", "LinkedIn", "Snapchat", "Signal", "Email", "SMS", "Other",
];


// ─── props ────────────────────────────────────────────────────────────────────
interface ReportFormProps {
  isAuthenticated?: boolean;
  userEmail?: string;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ReportForm({ isAuthenticated = false, userEmail }: ReportFormProps) {
  const router = useRouter();
  const screenshotRef = useRef<HTMLInputElement>(null);
  const { language, isDualLang } = useLanguage();
  const t = useT();

  // Current language strings
  const tr = translations[language].report;
  // Secondary language strings for dual-label mode (always EN↔SW)
  const sec = isDualLang
    ? translations[language === "en" ? "sw" : "en"].report
    : null;

  // Helper: render a field label. In dual-lang mode shows "primary (secondary)".
  function L(enKey: keyof typeof translations.en.report.fields) {
    const primary = tr.fields[enKey] as string;
    const secondary = sec ? (sec.fields[enKey] as string) : "";
    return <DL primary={primary} secondary={secondary} isDual={isDualLang} />;
  }

  function optLabel(
    group: keyof typeof translations.en.report.options,
    key: string,
  ): string {
    const primary = (tr.options[group] as Record<string, string>)[key] ?? key;
    if (!isDualLang || !sec) return primary;
    const secondary = (sec.options[group] as Record<string, string>)[key] ?? "";
    return secondary ? `${primary} / ${secondary}` : primary;
  }

  // Context
  const [reportingFor, setReportingFor] = useState<"self"|"someone_else"|"child"|"community">("self");
  const [incidentTypes, setIncidentTypes] = useState<string[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const online = useOnline();
  const searchParams = useSearchParams();
  const [contentText, setContentText] = useState("");
  const [sharedNote, setSharedNote] = useState<string | null>(null);

  // What happened
  const [description, setDescription]   = useState("");
  const [county, setCounty]             = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [occurredDate, setOccurredDate] = useState("");
  const [occurredTime, setOccurredTime] = useState("");
  const [isOngoing, setIsOngoing]       = useState(false);
  const [latitude, setLatitude]         = useState<number|null>(null);
  const [longitude, setLongitude]       = useState<number|null>(null);

  // Who
  const [perpetratorType, setPerpType]     = useState("");
  const [perpetratorDetail, setPerpDetail] = useState("");

  // Online evidence
  const [platform, setPlatform]               = useState("");
  const [link, setLink]                       = useState("");
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotUrls]                      = useState<string[]>([]);
  const [uploading, setUploading]             = useState(false);

  // Support
  const [supportNeeded, setSupportNeeded] = useState<string[]>([]);
  const [supportOther, setSupportOther]   = useState("");
  const [urgency, setUrgency]             = useState<"immediate"|"within_week"|"no_rush">("within_week");
  const [consent, setConsent]             = useState(false);
  const [contactMethod, setContactMethod] = useState("");
  const [contactValue, setContactValue]   = useState("");

  // Account
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // State
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string|null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [offlineSaved, setOfflineSaved] = useState(false);

  const isOnline = incidentTypes.some(t => ONLINE_INCIDENT_TYPES.includes(t));

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { setLatitude(p.coords.latitude); setLongitude(p.coords.longitude); },
      () => {}
    );
  }, []);

  // Something shared to the app from another app (a link, a screenshot, a photo) opens the form
  // already filled in. Nothing is sent until the person presses submit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      let shared: SharedItem | null = null;
      if (searchParams.get("shared") === "1") shared = await readShared();
      else if (searchParams.get("link") || searchParams.get("text")) {
        shared = { title: "", text: searchParams.get("text") ?? "", url: searchParams.get("link") ?? "", files: [], at: Date.now() };
      }
      if (!shared || cancelled) return;

      const url = shared.url || firstUrl(`${shared.text} ${shared.title}`) || "";
      // The words people share usually are the address; keep anything else they wrote.
      const words = [shared.title, shared.text].filter(Boolean).join("\n\n").replace(url, "").trim();
      const files = shared.files.slice(0, 10).map((f) => new File([f.blob], f.name, { type: f.type }));

      if (url) {
        setLink(url);
        const plat = platformFromUrl(url);
        if (plat) setPlatform(plat);
        setIncidentTypes((cur) => (cur.includes("digital_threats") ? cur : [...cur, "digital_threats"]));
        const preview = await previewSharedPost(url).catch(() => null);
        if (preview && !cancelled) setContentText(`${preview.author ? preview.author + ": " : ""}${preview.text}`);
      }
      if (words) setDescription((d) => d || words);
      if (files.length) setScreenshotFiles((cur) => [...cur, ...files].slice(0, 10));
      const parts = [url && "a link", files.length && `${files.length} file${files.length === 1 ? "" : "s"}`, words && "some words"].filter(Boolean);
      setSharedNote(`Shared with WHRD Hub: ${parts.join(", ") || "something"}. Add what happened and press submit; nothing has been sent yet.`);
      await clearShared();
    })();
    return () => { cancelled = true; };
    // Runs once, when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (incidentTypes.length === 0) errs.violenceType = tr.errors.violenceType;
    if (description.trim().length < 20) errs.description = tr.errors.descriptionMin(description.trim().length);
    if (!county) errs.county = tr.errors.county;
    if (!perpetratorType) errs.perpetrator = "Please tell us who did this, or choose Unknown.";
    if (!isAuthenticated && password.length < 8) errs.password = tr.errors.password;
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);

    // Detect connectivity up front. When offline we skip the (network-bound)
    // screenshot upload and queue the report locally instead of hitting the server.
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

    // Declared outside the try so the catch block can queue it if the network
    // drops mid-request.
    let payload: ReportData | null = null;

    // Persist a report to the on-device offline queue and show confirmation.
    const saveOffline = async (p: ReportData): Promise<boolean> => {
      try {
        // A voice note can wait too, but only for someone signed in: it needs their session to be saved.
        await enqueueReport(p, isAuthenticated ? voiceBlob ?? undefined : undefined);
        await requestBackgroundSync();
        if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
        setOfflineSaved(true);
        return true;
      } catch {
        setError(
          "You appear to be offline and this device could not save your report locally. Please reconnect and try again."
        );
        return false;
      }
    };

    try {
      let uploadedUrls = [...screenshotUrls];
      if (!isOffline && screenshotFiles.length > 0 && isAuthenticated) {
        setUploading(true);
        const { urls, errors } = await uploadReportScreenshots("", screenshotFiles);
        if (errors.length) toast.error(`${tr.uploadFailed}: ${errors[0]}`);
        uploadedUrls = urls;
        setUploading(false);
      }

      // "Other" only counts when the person said what they need.
      const allSupport = supportNeeded.filter(s => s !== "other" || supportOther.trim());

      // A signed-in reporter can attach a voice note straight away. Anonymous reporters
      // have no account until the report is filed, so theirs is attached just after.
      let voicePaths: string[] = [];
      if (!isOffline && voiceBlob && isAuthenticated) {
        const path = await uploadReportVoiceNote(voiceBlob);
        if (path) voicePaths = [path]; else toast.error("Your voice note could not be saved. The report will be sent without it.");
      }

      payload = {
        voice_note_paths: voicePaths.length ? voicePaths : undefined,
        incident_types: incidentTypes,
        description,
        reporting_for: reportingFor === "child" || reportingFor === "community"
          ? "someone_else"
          : (reportingFor as "self"|"someone_else"),
        county,
        country: countryOf(county) ?? undefined,
        location_description: locationDesc || undefined,
        latitude:  latitude  ?? undefined,
        longitude: longitude ?? undefined,
        occurred_at: occurredDate || undefined,
        occurred_time: occurredTime || undefined,
        is_ongoing: isOngoing,
        perpetrator_type: perpetratorType || undefined,
        perpetrator_detail: perpetratorDetail || undefined,
        tfgbv_platform: isOnline && platform ? platform : undefined,
        tfgbv_link: isOnline && link ? link : undefined,
        tfgbv_content_text: isOnline && contentText.trim() ? contentText.trim() : undefined,
        tfgbv_screenshot_urls: uploadedUrls.length ? uploadedUrls : undefined,
        support_needed: allSupport,
        support_other: allSupport.includes("other") ? supportOther.trim() : undefined,
        urgency,
        consent_to_followup: consent,
        contact_method: consent && contactMethod ? contactMethod : undefined,
        contact_value: consent && contactValue ? contactValue : undefined,
        password: isAuthenticated ? undefined : password,
        is_authenticated: isAuthenticated,
        reporter_type: isAuthenticated ? "authenticated" : "anonymous",
      };

      // Offline: queue locally and confirm. It will sync automatically once the
      // device is back online (and, for authenticated reports, signed in).
      if (isOffline) {
        await saveOffline(payload);
        setLoading(false);
        return;
      }

      const result = await submitReport(payload);
      if (result.success) {
        // Remembered for this tab only, so the next page can show a safety plan that fits what happened.
        try { sessionStorage.setItem("whrd:last-incident-types", JSON.stringify(incidentTypes)); } catch { /* storage blocked */ }
        if (isAuthenticated) {
          toast.success("Report submitted. Thank you for your courage.");
          router.push("/dashboard/reports");
        } else {
          const browserSupabase = createBrowserSupabase();
          await browserSupabase.auth.signInWithPassword({
            email: result.virtualEmail!,
            password,
          });
          // Anonymous reporters have no account until now, so their screenshots were never uploaded.
          // With a session in hand, save them against the new report.
          if (screenshotFiles.length > 0 && result.reportId) {
            const { urls, errors } = await uploadReportScreenshots("", screenshotFiles);
            if (urls.length) await attachScreenshots(result.reportId, urls).catch(() => undefined);
            if (errors.length) toast.error(`${tr.uploadFailed}: ${errors[0]}`);
          }
          // Now there is a session, the voice note can be saved against the new report.
          if (voiceBlob && result.reportId) {
            const path = await uploadReportVoiceNote(voiceBlob);
            if (path) await attachVoiceNote(result.reportId, [path]).catch(() => undefined);
          }
          const params = new URLSearchParams({ u: result.username!, rid: result.reportId || "" });
          router.push(`/report/success?${params}`);
        }
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Report submission error:", err);
      // A thrown error usually means the request never reached the server
      // (e.g. the connection dropped). If we're offline, queue it rather than
      // losing the report.
      const nowOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (payload && nowOffline) {
        await saveOffline(payload);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Perpetrator options from translations
  const PERPETRATOR_TYPES = Object.entries(tr.options.perpetrators).map(([value, label]) => ({ value, label }));
  // Labels come from the active language where we have them; referral is not something to ask for.
  const SUPPORT_OPTIONS   = SUPPORT_TYPES.map(({ value, label }) => ({
    value,
    label: (tr.options.support as Record<string, string>)[value] ?? label,
  }));

  // Offline confirmation — shown after a report is queued on-device.
  if (offlineSaved) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple/10 text-purple flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-purple">Saved on your device</h2>
          <p className="text-sm text-muted leading-relaxed">
            You&apos;re currently offline, so your report has been stored securely on this
            device. It will be submitted automatically as soon as you reconnect
            {isAuthenticated ? "" : " and your secure account is created"}. You can
            safely close this page &mdash; just reopen the app while online.
          </p>
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Keep this app installed and reopen it once you have a connection.
              Don&apos;t clear your browser data before it syncs, or the saved report
              could be lost.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-2xl mx-auto">

      {/* Screen-reader live region — announces validation errors on submit */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {Object.keys(fieldErrors).length > 0 &&
          `Form has ${Object.keys(fieldErrors).length} error${Object.keys(fieldErrors).length > 1 ? "s" : ""}. ${Object.values(fieldErrors).join(". ")}.`
        }
      </div>

      {sharedNote && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-purple/20 bg-purple-050 px-4 py-3 text-sm text-purple-700">
          <p>{sharedNote}</p>
          <button type="button" onClick={() => setSharedNote(null)} aria-label="Dismiss" className="shrink-0 text-purple-700/70 hover:text-purple-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Context ─────────────────────────────────────────────── */}
      <Card title={tr.sections.aboutReport} subtitle={tr.sections.aboutReportSub}>
        <Field label={L("reportingFor")}>
          <div className="flex flex-wrap gap-2">
            {(["self", "child", "someone_else", "community"] as const).map(opt => (
              <Pill
                key={opt}
                selected={reportingFor === opt}
                onClick={() => setReportingFor(opt)}
              >
                {optLabel("reportingFor", opt)}
              </Pill>
            ))}
          </div>
        </Field>

        <Field
          label={L("whereViolence")}
          required
          error={fieldErrors.violenceType}
          hint="Choose every type that applies."
        >
          <div className="flex flex-wrap gap-2">
            {INCIDENT_TYPES.map(opt => (
              <Pill
                key={opt.value}
                selected={incidentTypes.includes(opt.value)}
                onClick={() => {
                  toggle(incidentTypes, opt.value, setIncidentTypes);
                  setFieldErrors(p => ({ ...p, violenceType: "" }));
                }}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
        </Field>
      </Card>

      {/* ── What happened ────────────────────────────────────────── */}
      <Card title={tr.sections.whatHappened} subtitle={tr.sections.whatHappenedSub}>
        <Field
          id="field-description"
          label={L("description")}
          required
          error={fieldErrors.description}
          hint={!fieldErrors.description && description.length < 20 ? `${description.length}/20 min` : undefined}
        >
          <Textarea
            id="field-description"
            value={description}
            onChange={e => {
              setDescription(e.target.value);
              if (e.target.value.trim().length >= 20) setFieldErrors(p => ({ ...p, description: "" }));
            }}
            rows={5}
            placeholder={tr.fields.descriptionPlaceholder}
            aria-required="true"
            aria-invalid={!!fieldErrors.description}
            aria-describedby={fieldErrors.description ? "field-description-error" : "field-description-hint"}
            className={`rounded-xl resize-none ${fieldErrors.description ? "border-rose-600 focus-visible:ring-rose-600/30" : ""}`}
          />
        </Field>

        <VoiceInput
          defaultLang={language === "sw" ? "sw-KE" : "en-KE"}
          onText={(t) => setDescription((d) => (d.trim() ? `${d.trimEnd()} ${t}` : t))}
          onRecording={setVoiceBlob}
          canAttach={online || isAuthenticated}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Field label={L("when")}>
              <input
                type="date"
                value={occurredDate}
                onChange={e => setOccurredDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </Field>
            <Field label="Specify the time" hint="Optional. Your best estimate is fine.">
              <input
                type="time"
                value={occurredTime}
                onChange={e => setOccurredTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </Field>
          </div>

          <Field id="field-county" label={L("county")} required error={fieldErrors.county}>
            <Select
              id="field-county"
              value={county}
              onChange={v => { setCounty(v); if (v) setFieldErrors(p => ({ ...p, county: "" })); }}
              placeholder={tr.fields.countyPlaceholder}
              hasError={!!fieldErrors.county}
              describedBy={fieldErrors.county ? "field-county-error" : undefined}
            >
              <optgroup label="Kenya: counties">
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
              <optgroup label="Other countries">
                {OTHER_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </Select>
          </Field>
        </div>

        <Field label={L("location")}>
          <input
            type="text"
            value={locationDesc}
            onChange={e => setLocationDesc(e.target.value)}
            placeholder={tr.fields.locationPlaceholder}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
          />
        </Field>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isOngoing}
            onChange={e => setIsOngoing(e.target.checked)}
            className="w-4 h-4 rounded accent-[#734e9e]"
          />
          <span className="text-sm text-muted group-hover:text-ink transition-colors">
            {isDualLang && sec
              ? <DL primary={tr.fields.isOngoing} secondary={sec.fields.isOngoing} isDual />
              : tr.fields.isOngoing
            }
          </span>
        </label>

        {latitude && (
          <p className="flex items-center gap-2 text-xs text-green-800 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {tr.gps}
          </p>
        )}
      </Card>

      {/* ── Who did this ─────────────────────────────────────────── */}
      <Card title={tr.sections.whoDid} subtitle={tr.sections.whoDid_sub}>
        <Field required error={fieldErrors.perpetrator} label={<span className="sr-only">Who did this</span>}>
          <div className="flex flex-wrap gap-2">
            {PERPETRATOR_TYPES.map(opt => (
              <Pill
                key={opt.value}
                selected={perpetratorType === opt.value}
                onClick={() => { setPerpType(opt.value); setFieldErrors(p => ({ ...p, perpetrator: "" })); }}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
        </Field>
        {perpetratorType && (
          <Field label={tr.fields.perpetratorDetail} hint={tr.fields.perpetratorDetailHint}>
            <input
              type="text"
              value={perpetratorDetail}
              onChange={e => setPerpDetail(e.target.value)}
              placeholder={tr.fields.perpetratorDetailPlaceholder}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
            />
          </Field>
        )}
      </Card>

      {/* ── Online evidence ───────────────────────────────────────── */}
      {isOnline && (
        <Card title={tr.sections.onlineEvidence} subtitle={tr.sections.onlineEvidenceSub}>
          <Field label={L("platform")}>
            <Select value={platform} onChange={setPlatform} placeholder={tr.fields.platformPlaceholder}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>

          <Field label={L("link")}>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={platform === "Signal" ? "signal://..." : "https://..."}
                className="w-full rounded-xl border border-line bg-surface pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
          </Field>

          <Field label="What the post says (optional)" hint="Copy or paste the words, so they are kept even if the post is deleted.">
            <Textarea
              value={contentText}
              onChange={e => setContentText(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </Field>

          <Field label={L("screenshots")}>
            <input
              ref={screenshotRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (screenshotFiles.length + files.length > 10) {
                  toast.error(tr.maxFiles); return;
                }
                setScreenshotFiles(prev => [...prev, ...files]);
                if (screenshotRef.current) screenshotRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => screenshotRef.current?.click()}
              disabled={uploading || screenshotFiles.length >= 10}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-dashed border-line hover:border-purple/40 bg-paper text-sm font-medium text-muted hover:text-ink transition-colors"
            >
              <Upload className="w-4 h-4" />
              {tr.fields.screenshotsHint}
            </button>
            {screenshotFiles.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {screenshotFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-line text-sm">
                    <ImageIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setScreenshotFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {screenshotUrls.length > 0 && (
              <p className="text-xs text-green-700 flex items-center gap-1.5 mt-1">
                <Check className="w-3.5 h-3.5" />
                {screenshotUrls.length} file(s) uploaded
              </p>
            )}
          </Field>
        </Card>
      )}

      {/* ── Support ───────────────────────────────────────────────── */}
      <Card title={tr.sections.support} subtitle={tr.sections.supportSub}>
        <Field label={L("supportType")}>
          <div className="flex flex-wrap gap-2">
            {SUPPORT_OPTIONS.map(opt => (
              <Pill
                key={opt.value}
                selected={supportNeeded.includes(opt.value)}
                onClick={() => toggle(supportNeeded, opt.value, setSupportNeeded)}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
          {supportNeeded.includes("other") && (
            <Textarea
              value={supportOther}
              onChange={e => setSupportOther(e.target.value)}
              rows={2}
              placeholder="Tell us what support you need"
              aria-label="Describe the support you need"
              className="rounded-xl mt-2"
            />
          )}
        </Field>

        <Field label={L("urgency")} required>
          <div className="space-y-2">
            {(["immediate", "within_week", "no_rush"] as const).map(value => {
              const label = (tr.options.urgency as Record<string, string>)[value] ?? value;
              const sub   = isDualLang && sec
                ? (sec.options.urgency as Record<string, string>)[value]
                : undefined;
              const tone = URGENCY_META[value].tone;
              const on = {
                red:   "bg-rose-600 text-white border-rose-600",
                amber: "bg-amber-500 text-white border-amber-500",
                green: "bg-emerald-600 text-white border-emerald-600",
              }[tone];
              const idle = {
                red:   "hover:border-rose-600/40",
                amber: "hover:border-amber-500/40",
                green: "hover:border-emerald-600/40",
              }[tone];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUrgency(value)}
                  aria-pressed={urgency === value}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all
                    ${urgency === value ? on : `bg-surface border-line ${idle}`}`}
                >
                  <span className="font-semibold">{label}</span>
                  {sub && <span className="block text-[11px] mt-0.5 opacity-70">{sub}</span>}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="rounded-xl border border-line bg-paper p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-[#734e9e]"
            />
            <span className="text-sm">
              {isDualLang && sec
                ? <DL primary={tr.fields.consent} secondary={sec.fields.consent} isDual />
                : tr.fields.consent
              }
            </span>
          </label>
          {consent && (
            <div className="grid sm:grid-cols-2 gap-3 pl-7">
              <Select value={contactMethod} onChange={setContactMethod} placeholder={tr.fields.contactMethod}>
                <option value="phone">Phone call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
              <input
                type="text"
                value={contactValue}
                onChange={e => setContactValue(e.target.value)}
                placeholder={tr.fields.contactValue}
                className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Account ───────────────────────────────────────────────── */}
      <Card title={tr.sections.yourAccount}>
        {isAuthenticated ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <Shield className="w-5 h-5 text-green-700 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-green-800">
                {isDualLang && sec
                  ? <DL primary={tr.account.signedIn} secondary={sec.account.signedIn} isDual />
                  : tr.account.signedIn
                }
              </p>
              {userEmail && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-green-700">{userEmail}</span>
                  <CopyButton text={userEmail} label={t.common.copy} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-purple/5 border border-purple/15">
              <Shield className="w-5 h-5 text-purple shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  {isDualLang && sec
                    ? <DL primary={tr.account.autoUsername} secondary={sec.account.autoUsername} isDual />
                    : tr.account.autoUsername
                  }
                </p>
                <p className="text-xs text-muted">{tr.account.autoUsernameSub}</p>
              </div>
            </div>

            <Field
              label={
                isDualLang && sec
                  ? <DL primary={tr.fields.password} secondary={sec.fields.password} isDual />
                  : tr.fields.password
              }
              required
              error={fieldErrors.password}
            >
              <div className="relative">
                <input
                  id="field-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (e.target.value.length >= 8) setFieldErrors(p => ({ ...p, password: "" }));
                  }}
                  placeholder={tr.fields.passwordPlaceholder}
                  aria-required="true"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "field-password-error" : undefined}
                  className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2
                    ${fieldErrors.password ? "border-rose-600 focus:ring-rose-600/30" : "border-line focus:ring-purple"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPass ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </Field>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-0.5">
              <p className="font-semibold">{tr.account.writeDownPassword}</p>
              <p className="text-xs">{tr.account.writeDownPasswordSub}</p>
            </div>
          </>
        )}

        <div className="p-4 rounded-xl bg-paper border border-line text-xs text-muted space-y-1.5">
          <p className="font-semibold text-ink text-sm">{tr.sections.consentDeclaration}</p>
          <ul className="list-disc list-inside space-y-1">
            {tr.account.consentItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-600/10 border border-rose-600/20 text-rose-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────── */}
      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-12 text-sm font-bold rounded-xl"
      >
        {loading || uploading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploading ? tr.buttons.uploading : tr.buttons.submitting}</>
        ) : (
          <><Shield className="w-4 h-4 mr-2" />{tr.buttons.submit}</>
        )}
      </Button>

      <p className="text-center text-xs text-muted pb-4">
        Protected under the Kenya Data Protection Act (2019). All data is encrypted at rest and in transit.
      </p>
    </div>
  );
}

