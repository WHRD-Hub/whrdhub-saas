import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, Calendar, Shield, AlertCircle, FileText, Phone, Mail, Globe,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { matchMeta } from "@/lib/match-state";
import { ReferralResponse } from "@/components/reporting/referral-response";
import { translations } from "@/lib/i18n/translations";
import { getServerLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Report details — WHRD Hub" };

type Tone = "amber" | "green" | "red" | "slate" | "purple" | "cyan" | "magenta";

/** A labelled block inside a detail card. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-black text-ink">
        {Icon && <Icon className="h-4.5 w-4.5 text-purple" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

interface AssignedService {
  id: string;
  assigned_at: string | null;
  note: string | null;
  match_status: string | null;
  services: {
    name: string;
    description: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    contact_url: string | null;
  } | null;
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const lang = await getServerLanguage(profile?.preferred_language as string | null);
  const t = translations[lang].reportDetail;
  const td = translations[lang].dashboard;

  // The user_id filter is belt-and-braces on top of RLS: a member may only
  // ever open their own report.
  const { data: report, error } = await supabase
    .from("reports")
    .select(
      `*,
       report_services (
         id, service_id, assigned_at, note, match_status,
         services (id, name, description, contact_phone, contact_email, contact_url)
       )`,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !report) return notFound();

  // Matching runs the moment a report is filed, so support reaches the person
  // who needs it without waiting on a fact-check. Somebody describing an
  // immediate threat should not be told to come back when a case worker has
  // had time to look.
  const services: AssignedService[] =
    (report.report_services ?? []) as unknown as AssignedService[];

  const STATUS: Record<string, { tone: Tone; label: string }> = {
    submitted: { tone: "amber", label: td.statusSubmitted },
    under_review: { tone: "cyan", label: td.statusUnderReview },
    referred: { tone: "green", label: td.statusReferred },
    closed: { tone: "slate", label: td.statusClosed },
    flagged: { tone: "red", label: td.statusFlagged },
  };
  const VERIF: Record<string, { tone: Tone; label: string }> = {
    pending: { tone: "amber", label: td.verifPending },
    verified: { tone: "green", label: td.verifVerified },
    unverified: { tone: "red", label: td.verifUnverified },
    needs_more_info: { tone: "magenta", label: td.verifNeedsMoreInfo },
  };

  const sm = STATUS[report.status as string] ?? STATUS.submitted;
  const vm = VERIF[report.verification_status as string] ?? VERIF.pending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/reports"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-purple"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
          <h1 className="text-2xl font-black text-ink">{t.title}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {(report.id as string).slice(0, 8)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={sm.tone}>{sm.label}</Pill>
          <Pill tone={vm.tone}>{vm.label}</Pill>
        </div>
      </div>

      <Section title={t.reportContext} icon={Shield}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label={t.reportingFor}>
            <span className="capitalize">
              {(report.reporting_for as string)?.replace(/_/g, " ") ?? "—"}
            </span>
          </Row>
          <Row label={t.violenceType}>
            <span className="capitalize">
              {((report.incident_types as string[]) ?? [])
                .map((it) => it.replace(/_/g, " "))
                .join(", ") || "—"}
            </span>
          </Row>
        </dl>
      </Section>

      <Section title={t.whatHappened} icon={AlertCircle}>
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              {t.description}
            </p>
            <p className="whitespace-pre-line rounded-xl bg-paper p-3.5 text-sm leading-relaxed text-ink">
              {report.description as string}
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label={t.county}>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted" />
                {(report.county as string) || t.notSpecified}
              </span>
            </Row>
            <Row label={t.whenOccurred}>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted" />
                {report.occurred_at
                  ? new Date(report.occurred_at as string).toLocaleDateString()
                  : t.notSpecified}
              </span>
            </Row>
          </dl>
          {report.location_description ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {t.locationDetails}
              </p>
              <p className="rounded-xl bg-paper p-3.5 text-sm text-ink">
                {report.location_description as string}
              </p>
            </div>
          ) : null}
          {report.is_ongoing ? (
            <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t.ongoing}
            </p>
          ) : null}
        </div>
      </Section>

      {report.perpetrator_type ? (
        <Section title={t.perpetratorInfo}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label={t.perpetratorType}>
              <span className="capitalize">
                {(report.perpetrator_type as string).replace(/_/g, " ")}
              </span>
            </Row>
            {report.perpetrator_detail ? (
              <Row label={t.perpetratorDetails}>
                {report.perpetrator_detail as string}
              </Row>
            ) : null}
          </dl>
        </Section>
      ) : null}

      {report.tfgbv_platform ? (
        <Section title={t.onlineEvidence} icon={FileText}>
          <dl className="space-y-4">
            <Row label={t.platform}>{report.tfgbv_platform as string}</Row>
            {report.tfgbv_link ? (
              <Row label={t.link}>
                <a
                  href={report.tfgbv_link as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all rounded-lg bg-paper p-2 font-mono text-xs text-purple hover:underline"
                >
                  {report.tfgbv_link as string}
                </a>
              </Row>
            ) : null}
          </dl>
          {((report.tfgbv_screenshot_urls as string[]) ?? []).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {t.screenshots} ({(report.tfgbv_screenshot_urls as string[]).length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(report.tfgbv_screenshot_urls as string[]).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-line transition-opacity hover:opacity-80"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Screenshot ${i + 1}`} className="h-40 w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      {((report.support_needed as string[]) ?? []).length > 0 && (
        <Section title={t.supportRequested}>
          <div className="flex flex-wrap gap-2">
            {(report.support_needed as string[]).map((s) => (
              <Pill key={s} tone="purple">
                <span className="capitalize">{s.replace(/_/g, " ")}</span>
              </Pill>
            ))}
          </div>
        </Section>
      )}

      <Section title={t.assignedServices}>
        {services.length === 0 ? (
          <p className="text-sm text-muted">{t.notSpecified}</p>
        ) : (
          <div className="space-y-3">
            {services.map((a) => {
              const svc = Array.isArray(a.services) ? a.services[0] : a.services;
              return (
                <div key={a.id} className="rounded-xl border border-line p-4">
                  <h3 className="font-bold text-ink">{svc?.name}</h3>
                  {svc?.description && (
                    <p className="mt-1 text-sm text-muted">{svc.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    {svc?.contact_phone && (
                      <a
                        href={`tel:${svc.contact_phone}`}
                        className="inline-flex items-center gap-1 text-purple hover:underline"
                      >
                        <Phone className="h-3 w-3" /> {svc.contact_phone}
                      </a>
                    )}
                    {svc?.contact_email && (
                      <a
                        href={`mailto:${svc.contact_email}`}
                        className="inline-flex items-center gap-1 text-purple hover:underline"
                      >
                        <Mail className="h-3 w-3" /> {svc.contact_email}
                      </a>
                    )}
                    {svc?.contact_url && (
                      <a
                        href={svc.contact_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple hover:underline"
                      >
                        <Globe className="h-3 w-3" /> Website
                      </a>
                    )}
                  </div>
                  {a.note && <p className="mt-2 text-sm text-ink/70">{a.note}</p>}
                  {a.assigned_at && (
                    <p className="mt-2 text-xs text-muted">
                      {t.assignedOn} {new Date(a.assigned_at).toLocaleDateString()}
                    </p>
                  )}

                  {/* Where this offer stands, and what she can do about it. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={matchMeta(a.match_status).tone}>
                      {matchMeta(a.match_status).survivorLabel}
                    </Pill>
                  </div>
                  {(a.match_status === "proposed" || a.match_status === "provider_accepted") && (
                    <ReferralResponse referralId={a.id} serviceName={svc?.name ?? "The service"} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={t.contactUrgency}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label={t.urgency}>
            <span className="capitalize">
              {(report.urgency as string)?.replace(/_/g, " ") ?? "—"}
            </span>
          </Row>
          {report.contact_method ? (
            <>
              <Row label={t.preferredContact}>
                <span className="capitalize">
                  {(report.contact_method as string).replace(/_/g, " ")}
                </span>
              </Row>
              <Row label={t.contactDetails}>
                <span className="rounded bg-paper p-2 font-mono text-xs">
                  {report.contact_value as string}
                </span>
              </Row>
            </>
          ) : null}
        </dl>
      </Section>

      <Section title={t.timeline}>
        <dl className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted">{t.submitted}</dt>
            <dd className="font-medium text-ink">
              {new Date(report.created_at as string).toLocaleString()}
            </dd>
          </div>
          {report.updated_at ? (
            <div className="flex items-center justify-between text-sm">
              <dt className="text-muted">{t.lastUpdated}</dt>
              <dd className="font-medium text-ink">
                {new Date(report.updated_at as string).toLocaleString()}
              </dd>
            </div>
          ) : null}
        </dl>
      </Section>
    </div>
  );
}
