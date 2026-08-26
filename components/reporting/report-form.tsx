"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
        transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out
        active:scale-[0.97]
        ${selected
          ? danger
            ? "bg-rose-600 text-white border-rose-600 shadow-sm"
            : "bg-purple text-white border-purple shadow-sm"
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
    <div className="bg-surface rounded-xl sm:rounded-2xl border border-line shadow-sm p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5">
      {title && (
        <div className="space-y-0.5">
          <h2 className="font-bold text-base text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
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
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
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

const COUNTIES = [
  "Nairobi","Mombasa","Kisumu","Nakuru","Uasin Gishu","Kilifi","Kwale","Kakamega",
  "Bungoma","Machakos","Kajiado","Nyeri","Meru","Embu","Kisii","Migori","Homa Bay",
  "Siaya","Trans Nzoia","Turkana","Garissa","Wajir","Mandera","Marsabit","Isiolo",
  "Laikipia","Nyandarua","Kirinyaga","Murang'a","Kiambu","Narok","Bomet","Kericho",
  "Baringo","Nandi","Samburu","Kitui","Makueni","Taita Taveta","Tana River","Lamu",
  "Other / Outside Kenya",
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
  const [violenceType, setViolenceType] = useState<"online"|"physical"|"both"|"">("");

  // What happened
  const [description, setDescription]   = useState("");
  const [county, setCounty]             = useState("");
  const [countyOther, setCountyOther]   = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [occurredDate, setOccurredDate] = useState("");
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

  const isOnline = violenceType === "online" || violenceType === "both";

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { setLatitude(p.coords.latitude); setLongitude(p.coords.longitude); },
      () => {}
    );
  }, []);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!violenceType) errs.violenceType = tr.errors.violenceType;
    if (description.trim().length < 20) errs.description = tr.errors.descriptionMin(description.trim().length);
    if (!county) errs.county = tr.errors.county;
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
        await enqueueReport(p);
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

      const incidentTypes: string[] = [];
      if (violenceType === "online" || violenceType === "both") incidentTypes.push("online_harassment");
      if (violenceType === "physical" || violenceType === "both") incidentTypes.push("physical_violence");

      const allSupport = [...supportNeeded.filter(s => s !== "other")];
      if (supportNeeded.includes("other") && supportOther.trim()) allSupport.push("other");

      payload = {
        incident_types: incidentTypes,
        description,
        reporting_for: reportingFor === "child" || reportingFor === "community"
          ? "someone_else"
          : (reportingFor as "self"|"someone_else"),
        county: county === "Other / Outside Kenya" && countyOther.trim()
          ? countyOther.trim()
          : county,
        location_description: locationDesc || undefined,
        latitude:  latitude  ?? undefined,
        longitude: longitude ?? undefined,
        occurred_at: occurredDate || undefined,
        is_ongoing: isOngoing,
        perpetrator_type: perpetratorType || undefined,
        perpetrator_detail: perpetratorDetail || undefined,
        tfgbv_platform: isOnline && platform ? platform : undefined,
        tfgbv_link: isOnline && link ? link : undefined,
        tfgbv_screenshot_urls: uploadedUrls.length ? uploadedUrls : undefined,
        support_needed: allSupport,
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
        if (isAuthenticated) {
          toast.success("Report submitted. Thank you for your courage.");
          router.push("/dashboard/reports");
        } else {
          const browserSupabase = createBrowserSupabase();
          await browserSupabase.auth.signInWithPassword({
            email: result.virtualEmail!,
            password,
          });
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
  const SUPPORT_OPTIONS   = Object.entries(tr.options.support).map(([value, label]) => ({ value, label }));

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
        >
          <div className="flex flex-wrap gap-2">
            {(["online", "physical", "both"] as const).map(opt => (
              <Pill
                key={opt}
                selected={violenceType === opt}
                onClick={() => {
                  setViolenceType(opt);
                  setFieldErrors(p => ({ ...p, violenceType: "" }));
                }}
              >
                {optLabel("violenceType", opt)}
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

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={L("when")}>
            <input
              type="date"
              value={occurredDate}
              onChange={e => setOccurredDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
            />
          </Field>

          <Field id="field-county" label={L("county")} required error={fieldErrors.county}>
            <Select
              id="field-county"
              value={county}
              onChange={v => { setCounty(v); setCountyOther(""); if (v) setFieldErrors(p => ({ ...p, county: "" })); }}
              placeholder={tr.fields.countyPlaceholder}
              hasError={!!fieldErrors.county}
              describedBy={fieldErrors.county ? "field-county-error" : undefined}
            >
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            {county === "Other / Outside Kenya" && (
              <input
                type="text"
                value={countyOther}
                onChange={e => setCountyOther(e.target.value)}
                placeholder="Please specify your country or region"
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
                aria-label="Country or region name"
                autoFocus
              />
            )}
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
        <div className="flex flex-wrap gap-2">
          {PERPETRATOR_TYPES.map(opt => (
            <Pill
              key={opt.value}
              selected={perpetratorType === opt.value}
              onClick={() => setPerpType(perpetratorType === opt.value ? "" : opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
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
              placeholder="..."
              className="rounded-xl mt-2"
            />
          )}
        </Field>

        <Field label={L("urgency")} required>
          <div className="space-y-2">
            {([
              { value: "immediate",   danger: true  },
              { value: "within_week", danger: false },
              { value: "no_rush",     danger: false },
            ] as const).map(opt => {
              const label = (tr.options.urgency as Record<string, string>)[opt.value] ?? opt.value;
              const sub   = isDualLang && sec
                ? (sec.options.urgency as Record<string, string>)[opt.value]
                : undefined;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUrgency(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all
                    ${urgency === opt.value
                      ? opt.danger
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-purple text-white border-purple"
                      : `bg-surface border-line hover:border-purple/30 ${opt.danger ? "hover:border-rose-600/30" : ""}`
                    }`}
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

