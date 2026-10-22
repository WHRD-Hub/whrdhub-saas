import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, Shield, CheckCircle, XCircle, HelpCircle, MapPin, Calendar, User, AlertTriangle,
  Briefcase, Trash2, Phone, Mail, MessageCircle, Clock, Globe, Mic, Paperclip, HeartHandshake, ShieldAlert,
  Radio, FileSearch, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/pill";
import { CopyButton } from "@/components/reporting/copy-button";
import { PostView } from "@/components/reporting/listening/post-embed";
import { FactCheckForm } from "@/components/reporting/admin/fact-check-form";
import { AssignServiceForm } from "@/components/reporting/admin/assign-service-form";
import { ReportDelete } from "@/components/reporting/admin/report-delete";
import { getReportingAccess } from "@/lib/reporting-access";
import { incidentLabel, riskLabel, supportLabel } from "@/lib/reporting-options";
import { urgencyMeta } from "@/lib/urgency";
import { rankServices } from "@/lib/service-match";
import { extractTags } from "@/lib/hashtags";
import { generaliseArea } from "@/lib/geo-privacy";
import { suggestSupportCategory } from "@/lib/jev-uses";
import { timeAgo } from "@/lib/utils";

const VERIFICATION_META: Record<string, { label: string; icon: React.ReactNode; variant: "info" | "success" | "destructive" | "warning" }> = {
  pending:         { label: "Pending fact-check", icon: <HelpCircle className="w-4 h-4" />, variant: "info" },
  verified:        { label: "Verified, credible", icon: <CheckCircle className="w-4 h-4" />, variant: "success" },
  unverified:      { label: "Could not verify", icon: <XCircle className="w-4 h-4" />, variant: "destructive" },
  needs_more_info: { label: "Needs more info", icon: <AlertTriangle className="w-4 h-4" />, variant: "warning" },
};

const CHANNEL_LABEL: Record<string, string> = { web: "Web form", ussd: "USSD (feature phone)", api: "Online listening", mobile: "Mobile app" };
const REPORTING_FOR_LABEL: Record<string, string> = {
  self: "Reporting for themselves",
  someone_else: "Reporting for someone else",
  community_leader: "Reporting for their community",
};
const CONTACT_LABEL: Record<string, string> = { phone: "Phone call", whatsapp: "WhatsApp", sms: "SMS", email: "Email" };

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const stamp = (d: string) => new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** A titled card, the building block of the page. */
function Card({ title, icon: Icon, children, tone = "default" }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; tone?: "default" | "warm";
}) {
  return (
    <section className={`rounded-xl border bg-surface ${tone === "warm" ? "border-amber-200 bg-amber-50/40" : "border-line"}`}>
      <h2 className={`flex items-center gap-2 border-b px-4 py-2.5 text-[13px] font-semibold text-ink ${tone === "warm" ? "border-amber-200/70" : "border-line"}`}>
        {Icon && <Icon className="h-3.5 w-3.5 text-purple" />}
        {title}
      </h2>
      <div className="space-y-3.5 p-4">{children}</div>
    </section>
  );
}

/** A small label above a value. Renders nothing when there is no value. */
function Fact({ label, children, empty }: { label: string; children?: React.ReactNode; empty?: string }) {
  const has = children !== undefined && children !== null && children !== false && children !== "";
  if (!has && !empty) return null;
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 text-[11px] font-medium text-muted">{label}</dt>
      <dd className={`text-[13px] ${has ? "font-medium text-ink" : "text-muted"}`}>{has ? children : empty}</dd>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "purple" | "magenta" | "amber" | "cyan" | "slate" | "red" | "green" }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => <Pill key={i} tone={tone}>{i}</Pill>)}
    </div>
  );
}

async function ReportDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const access = await getReportingAccess();
  const canAdminister = !!access?.canAdminister;

  const { data: report } = await supabase.from("reports").select("*").eq("id", id).single();
  if (!report) notFound();

  // reports.user_id references auth.users, not profiles - fetch profile separately.
  const { data: profileData } = report.user_id
    ? await supabase.from("profiles").select("username, is_anonymous, email, user_type, account_kind").eq("id", report.user_id).maybeSingle()
    : { data: null };

  const { data: assignedServices } = await supabase
    .from("report_services")
    .select("id, note, service_id, assigned_at, services(name, category, contact_phone, contact_email, organization)")
    .eq("report_id", id);

  const { data: allServices } = await supabase.from("services").select("id, name, category, organization").eq("is_active", true).order("category");

  const { data: auditLog } = await supabase
    .from("report_audit_log")
    .select("action, notes, created_at, profiles!report_audit_log_viewed_by_fkey(username)")
    .eq("report_id", id)
    .order("created_at", { ascending: false })
    .limit(12);

  // Who verified, acknowledged or was assigned: names, not ids.
  const staffIds = [report.verified_by, report.acknowledged_by, report.assigned_to].filter(Boolean) as string[];
  const staffNames = new Map<string, string>();
  if (staffIds.length) {
    const { data: people } = await supabase.from("profiles").select("id, username, full_name").in("id", staffIds);
    for (const p of people ?? []) staffNames.set(p.id as string, (p.full_name as string) || (p.username as string) || "a team member");
  }

  // A case opened from online listening links back to the post it came from.
  type Capture = { author: string | null; source: string; permalink: string | null; captured_at: string; ai_class: string | null; ai_confidence: number | null; matched_keywords: string[] | null };
  let capture = null as Capture | null;
  const captureId = (report as { source_capture_id?: string | null }).source_capture_id;
  if (captureId) {
    const { data } = await createAdminClient()
      .from("listening_results")
      .select("author, source, permalink, captured_at, ai_class, ai_confidence, matched_keywords")
      .eq("id", captureId)
      .maybeSingle();
    capture = data as Capture | null;
  }
  const fromListening = !!capture || report.channel === "api";
  // The post to show as it appears online: the capture's, or the link a reporter gave.
  const embedLink = capture?.permalink ?? ((report.tfgbv_link as string | null) || null);
  const postTags = capture ? extractTags((report.description as string) || "") : [];

  const voicePaths = ((report as { voice_note_paths?: string[] | null }).voice_note_paths ?? []).slice(0, 3);
  const voiceUrls: string[] = [];
  if (voicePaths.length) {
    const { data: signed } = await createAdminClient().storage.from("report-screenshots").createSignedUrls(voicePaths, 3600);
    for (const s of signed ?? []) if (s.signedUrl) voiceUrls.push(s.signedUrl);
  }

  // Evidence files live in a private bucket; each is shown through a short-lived signed link.
  const evidencePaths = (((report as { tfgbv_screenshot_urls?: string[] | null }).tfgbv_screenshot_urls) ?? []).slice(0, 10);
  const evidence: { url: string; pdf: boolean }[] = [];
  if (evidencePaths.length) {
    const storagePaths = evidencePaths.filter((p) => !/^https?:/i.test(p));
    const signed = storagePaths.length
      ? (await createAdminClient().storage.from("report-screenshots").createSignedUrls(storagePaths, 3600)).data ?? []
      : [];
    const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    for (const p of evidencePaths) {
      const url = /^https?:/i.test(p) ? p : byPath.get(p);
      if (url) evidence.push({ url, pdf: /\.pdf($|\?)/i.test(p) });
    }
  }

  // What category does the free-text "Other" request fit? Only when the deployment has opted in to sending report text to Jev.
  const supportSuggestion = report.support_other ? await suggestSupportCategory(report.support_other as string) : null;

  const vm = (report.verification_status && VERIFICATION_META[report.verification_status]) || VERIFICATION_META.pending;
  const profile = profileData as { username?: string; is_anonymous?: boolean; email?: string; user_type?: string; account_kind?: string } | null;
  const urgency = urgencyMeta(report.urgency);

  // Log the view; a triager opening a critical report is the acknowledgement that stops it being raised again.
  let ackedNow = false;
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (user) {
    await supabase.from("report_audit_log").insert({ report_id: id, viewed_by: user.id, action: "viewed" });
    const alertState = report as { alert_severity?: string | null; acknowledged_at?: string | null };
    if (alertState.alert_severity === "critical" && !alertState.acknowledged_at && access?.canTriage) {
      await createAdminClient().from("reports").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }).eq("id", id);
      ackedNow = true;
    }
  }

  const assignedServiceIds = new Set((assignedServices ?? []).map((s) => s.service_id));

  // Services are offered in the order that fits the case. A reported case also gets its best match picked for the
  // team to confirm; a case found by online listening has no requester, so nothing is picked and a person chooses.
  const supportNeeded = (report.support_needed as string[]) ?? [];
  const unassignedServices = (allServices ?? []).filter((s) => !assignedServiceIds.has(s.id));
  const { ordered: rankedServices, fits: fittingServices } = rankServices(unassignedServices, { incidentTypes: (report.incident_types as string[]) ?? [], supportNeeded: fromListening ? [] : supportNeeded });
  const suggestedServices = fromListening ? [] : rankedServices.filter((s) => fittingServices.has(s.id)).slice(0, 3);

  const types = ((report.incident_types as string[]) ?? []);
  const title = types.length ? types.map(incidentLabel).slice(0, 3).join(" · ") + (types.length > 3 ? ` +${types.length - 3}` : "") : "Report";
  const ref = (report.id as string).slice(0, 8).toUpperCase();
  const area = generaliseArea(report.latitude, report.longitude);
  const critical = report.alert_severity === "critical";
  const risks = ((report.risks as string[]) ?? []);
  const derogatory = ((report.derogatory_words as string[]) ?? []);
  const method = (report.contact_method as string) || "";
  const value = (report.contact_value as string) || "";
  const digits = value.replace(/[^\d+]/g, "");

  // One timeline from everything we know happened, newest first.
  const events: { at: string; text: string }[] = [{ at: report.created_at as string, text: `Filed through ${CHANNEL_LABEL[report.channel as string] ?? "the web form"}` }];
  if (critical && report.escalated_at) events.push({ at: report.escalated_at, text: `Raised as critical${(report.escalation_level ?? 1) > 1 ? `, escalation level ${report.escalation_level}` : ""}` });
  if (report.acknowledged_at) events.push({ at: report.acknowledged_at, text: `Acknowledged by ${staffNames.get(report.acknowledged_by as string) ?? "a team member"}` });
  if (ackedNow) events.push({ at: new Date().toISOString(), text: "Acknowledged by you, opening this case" });
  if (report.verified_at) events.push({ at: report.verified_at, text: `${vm.label}${report.verified_by ? ` by ${staffNames.get(report.verified_by as string) ?? "a team member"}` : ""}` });
  for (const s of assignedServices ?? []) {
    const svc = (Array.isArray(s.services) ? s.services[0] : s.services) as { name?: string } | null;
    if (s.assigned_at) events.push({ at: s.assigned_at as string, text: `Service assigned: ${svc?.name ?? "a service"}` });
  }
  if (report.updated_at && new Date(report.updated_at).getTime() - new Date(report.created_at).getTime() > 120_000) {
    events.push({ at: report.updated_at, text: "Report last changed" });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-3">
      {/* Header: one flat block, with the way back folded into its first line */}
      <header className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex">
          <span className="w-1 shrink-0" style={{ background: urgency.hex }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Link href={fromListening ? "/hub/reporting/listening" : "/hub/reporting/reports"} className="inline-flex items-center gap-1 font-semibold transition-colors hover:text-purple">
                    <ArrowLeft className="h-3 w-3" /> {fromListening ? "Online listening" : "Reports"}
                  </Link>
                  <span aria-hidden="true">/</span>
                  <span>Case <span className="font-mono text-ink">{ref}</span></span>
                  <CopyButton text={report.id as string} label="case ID" />
                </p>
                <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[report.county, report.country && report.country !== report.county ? report.country : null].filter(Boolean).join(", ") || "Location not given"}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Filed {timeAgo(report.created_at as string)}</span>
                  <span className="inline-flex items-center gap-1"><Radio className="h-3 w-3" />{CHANNEL_LABEL[report.channel as string] ?? "Web form"}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={vm.variant} className="flex items-center gap-1">{vm.icon} {vm.label}</Badge>
                <Badge variant="secondary">{titleCase((report.status as string) ?? "submitted")}</Badge>
                <Badge variant={urgency.badge}>{urgency.label} urgency</Badge>
                {report.is_ongoing && <Badge variant="warning">Still happening</Badge>}
                {fromListening && (
                  <span tabIndex={0} className="group relative inline-flex cursor-help items-center gap-1 rounded-full border border-purple/25 bg-purple-050 px-2.5 py-0.5 text-xs font-semibold text-purple-700 outline-none focus-visible:ring-2 focus-visible:ring-purple/40">
                    <Radio className="h-3 w-3" /> Found online
                    <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 hidden w-64 rounded-lg border border-line bg-surface p-2.5 text-xs font-normal leading-snug text-ink shadow-lg group-hover:block group-focus:block">
                      Nobody reported this. The team found it online and took it on, and nobody has contacted us about it.
                    </span>
                  </span>
                )}
                {canAdminister && <ReportDelete reportId={report.id as string} />}
              </div>
            </div>

            {critical && (
              <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <span className="font-bold">Critical case.</span>{" "}
                  {report.acknowledged_at || ackedNow
                    ? `Acknowledged${ackedNow ? " by you just now" : ` by ${staffNames.get(report.acknowledged_by as string) ?? "a team member"} ${timeAgo(report.acknowledged_at as string)}`}.`
                    : "Nobody has acknowledged it yet."}
                </p>
              </div>
            )}

            {report.deleted_at ? (
              <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-bold">This report is deleted.</span> The reporter can no longer see it. Restore it from Deleted reports.
                  {report.deleted_reason ? ` Reason: ${report.deleted_reason as string}` : ""}
                </span>
              </div>
            ) : null}

            {/* At a glance */}
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
              {[
                { k: "When it happened", v: report.occurred_at ? `${new Date(report.occurred_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}${report.occurred_time ? `, ${report.occurred_time}` : ""}` : "Not given", icon: Calendar },
                { k: "Who did it", v: report.perpetrator_type ? titleCase(report.perpetrator_type as string) : "Not given", icon: User },
                { k: "Support asked for", v: supportNeeded.length ? `${supportNeeded.length} type${supportNeeded.length === 1 ? "" : "s"}` : "None", icon: HeartHandshake },
                { k: "Risks listed", v: risks.length ? `${risks.length}` : "None", icon: ShieldAlert },
              ].map(({ k, v, icon: Icon }) => (
                <div key={k} className="bg-surface px-4 py-2">
                  <dt className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted"><Icon className="h-3 w-3" />{k}</dt>
                  <dd className="truncate text-[13px] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* ── Main column: everything the reporter told us ── */}
        <div className="space-y-3">
          <Card title="What happened" icon={Shield}>
            <div className={capture ? "grid items-start gap-4 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]" : ""}>
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted">{fromListening ? "The post" : "In their words"}</p>
                <PostView permalink={embedLink}>
                  <p className="whitespace-pre-line rounded-lg border border-line bg-paper/70 p-3 text-sm leading-relaxed text-ink">
                    {(report.description as string) || (report.what_description as string) || "No description was given."}
                  </p>
                </PostView>
              </div>
              {capture && (
                <dl className="space-y-3 rounded-lg border border-line bg-paper/40 p-3.5">
                  <Fact label="Account">{capture.author ?? "Unknown account"}</Fact>
                  <Fact label="Posted on">{capture.source === "x" ? "X" : capture.source.charAt(0).toUpperCase() + capture.source.slice(1)}</Fact>
                  <Fact label="Captured">{stamp(capture.captured_at)}</Fact>
                  <Fact label="Words matched">{capture.matched_keywords?.length ? <Chips items={capture.matched_keywords} tone="purple" /> : undefined}</Fact>
                  <Fact label="Hashtags">{postTags.length ? <Chips items={postTags.map((t) => "#" + t)} tone="slate" /> : undefined}</Fact>
                  {capture.permalink && (
                    <Fact label="Original">
                      <a href={capture.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-purple hover:underline">
                        Open the post <ExternalLink className="h-3 w-3" />
                      </a>
                    </Fact>
                  )}
                </dl>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Type of incident">
                <Chips items={types.map(incidentLabel)} tone="purple" />
              </Fact>
              <Fact label="Reporting for">{REPORTING_FOR_LABEL[report.reporting_for as string] ?? titleCase((report.reporting_for as string) ?? "")}</Fact>
              <Fact label="Who did this">
                {report.perpetrator_type ? titleCase(report.perpetrator_type as string) : undefined}
                {report.perpetrator_detail ? <span className="mt-0.5 block text-xs font-normal text-muted">{report.perpetrator_detail as string}</span> : null}
              </Fact>
              <Fact label="Still happening?">{report.is_ongoing ? "Yes, it is ongoing" : "No, it has stopped"}</Fact>
            </dl>

            {(report.how_description || report.activism_context) && (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="How it happened">{report.how_description as string}</Fact>
                <Fact label="Their activism context">{report.activism_context as string}</Fact>
              </dl>
            )}
          </Card>

          <Card title="When and where" icon={MapPin}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Date" empty="Not given">
                {report.occurred_at ? new Date(report.occurred_at).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : undefined}
              </Fact>
              <Fact label="Time" empty="Not given">{report.occurred_time as string}</Fact>
              <Fact label="County or country" empty="Not given">
                {[report.county, report.country && report.country !== report.county ? report.country : null].filter(Boolean).join(", ") || undefined}
              </Fact>
              <Fact label="Place described" empty="Not given">{report.location_description as string}</Fact>
              <Fact label="Map position">
                {area ? (
                  <a href={`https://www.openstreetmap.org/?mlat=${area.lat}&mlon=${area.lng}#map=10/${area.lat}/${area.lng}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-purple hover:underline">
                    Approximate area, about 10 km wide <ExternalLink className="h-3 w-3" />
                  </a>
                ) : undefined}
              </Fact>
            </dl>
            {area && <p className="text-xs text-muted">The exact point the reporter&apos;s device gave is stored but deliberately never shown.</p>}
          </Card>

          {(report.tfgbv_platform || report.tfgbv_link || report.tfgbv_content_text) && (
            <Card title="Online evidence" icon={Globe} tone="warm">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="Platform">{report.tfgbv_platform as string}</Fact>
                <Fact label="Attack nature">{report.attack_nature ? titleCase(report.attack_nature as string) : undefined}</Fact>
              </dl>
              {report.tfgbv_link && (
                <div>
                  <p className="mb-0.5 text-[11px] font-medium text-muted">Link</p>
                  <a href={report.tfgbv_link as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 break-all text-sm font-medium text-purple hover:underline">
                    {report.tfgbv_link as string} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {report.tfgbv_content_text && (
                <div>
                  <p className="mb-0.5 text-[11px] font-medium text-muted">Content they copied</p>
                  <p className="whitespace-pre-line rounded-xl bg-surface p-3 text-sm">{report.tfgbv_content_text as string}</p>
                </div>
              )}
            </Card>
          )}

          {(evidence.length > 0 || voiceUrls.length > 0 || ((report.evidence_types as string[]) ?? []).length > 0) && (
            <Card title="Files and recordings" icon={Paperclip}>
              {((report.evidence_types as string[]) ?? []).length > 0 && (
                <Fact label="Kinds of evidence they have">
                  <Chips items={(report.evidence_types as string[]).map(titleCase)} tone="cyan" />
                </Fact>
              )}
              {evidence.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted">Uploaded files ({evidence.length})</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {evidence.map((e, i) =>
                      e.pdf ? (
                        <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className="grid h-28 place-items-center rounded-xl border border-line bg-paper text-sm font-semibold text-purple hover:underline">
                          Open PDF {i + 1}
                        </a>
                      ) : (
                        <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-line transition-opacity hover:opacity-80">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={e.url} alt={`Evidence ${i + 1}`} className="h-28 w-full object-cover" />
                        </a>
                      ),
                    )}
                  </div>
                </div>
              )}
              {voiceUrls.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted"><Mic className="h-3 w-3" />Voice note</p>
                  <div className="space-y-2">
                    {voiceUrls.map((u) => (
                      <audio key={u} src={u} controls className="w-full" />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted">Links expire in an hour. Only the response team can open them.</p>
            </Card>
          )}

          <Card title="Support and risks" icon={HeartHandshake}>
            <dl className="space-y-4">
              <Fact label="Support they asked for" empty="No support selected">
                {supportNeeded.length ? <Chips items={supportNeeded.map(supportLabel)} tone="purple" /> : undefined}
              </Fact>
              {report.support_other && (
                <div className="rounded-xl border border-line bg-paper p-3.5 text-sm">
                  <p className="mb-0.5 text-[11px] font-medium text-muted">Other support, in their words</p>
                  <p className="whitespace-pre-line text-ink">{report.support_other as string}</p>
                  {supportSuggestion && (
                    <p className="mt-2 text-xs font-semibold text-purple-700">
                      Looks like a request for: {supportSuggestion.label} ({Math.round(supportSuggestion.confidence * 100)}%)
                    </p>
                  )}
                </div>
              )}
              <Fact label="Risks they face">
                {risks.length ? <Chips items={risks.map(riskLabel)} tone="amber" /> : undefined}
              </Fact>
            </dl>
          </Card>

          {(derogatory.length > 0 || report.defender_notes || report.verification_notes) && (
            <Card title="Team analysis" icon={FileSearch}>
              <dl className="space-y-4">
                <Fact label="Hateful or derogatory words recorded">
                  {derogatory.length ? <Chips items={derogatory} tone="red" /> : undefined}
                </Fact>
                <Fact label="Fact-check notes">
                  {report.verification_notes ? <span className="whitespace-pre-line">{report.verification_notes as string}</span> : undefined}
                </Fact>
                <Fact label="Defender notes">
                  {report.defender_notes ? <span className="whitespace-pre-line">{report.defender_notes as string}</span> : undefined}
                </Fact>
              </dl>
            </Card>
          )}

          <FactCheckForm
            reportId={id}
            currentStatus={report.verification_status ?? "pending"}
            currentNotes={report.verification_notes}
            currentIncidentTypes={report.incident_types as string[]}
            currentAttackNature={report.attack_nature}
            currentDerogatoryWords={report.derogatory_words as string[] | undefined}
          />
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-3 lg:sticky lg:top-[4.25rem] lg:max-h-[calc(100dvh-5rem)] lg:self-start lg:overflow-y-auto">
          {fromListening ? (
            <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Radio className="h-4 w-4 text-purple" />Reaching out</h3>
              <p className="rounded-lg border border-line bg-paper/70 p-3 text-xs leading-relaxed text-muted">
                There is no reporter to call or message. Use the original post and account to decide how, or whether, to reach out, and take care not to put anyone at risk.
              </p>
              <dl className="space-y-3">
                <Fact label="Assigned to">{report.assigned_to ? staffNames.get(report.assigned_to as string) ?? "A team member" : undefined}</Fact>
              </dl>
            </section>
          ) : (
            <>
          {/* Reaching the reporter */}
          <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Phone className="h-4 w-4 text-purple" />Reaching the reporter</h3>
            {value ? (
              <>
                <div className="rounded-lg border border-line bg-paper/70 p-3">
                  <p className="mb-0.5 text-[11px] font-medium text-muted">{CONTACT_LABEL[method] ?? "Contact"}</p>
                  <p className="break-all font-mono text-sm font-semibold text-ink">{value}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(method === "phone" || method === "sms" || method === "whatsapp" || !method) && digits && (
                    <a href={`tel:${digits}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple px-3 text-xs font-semibold text-white hover:bg-purple-600"><Phone className="h-3.5 w-3.5" />Call</a>
                  )}
                  {(method === "whatsapp" || method === "phone") && digits && (
                    <a href={`https://wa.me/${digits.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:bg-paper"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                  )}
                  {(method === "email" || value.includes("@")) && (
                    <a href={`mailto:${value}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple px-3 text-xs font-semibold text-white hover:bg-purple-600"><Mail className="h-3.5 w-3.5" />Email</a>
                  )}
                  <CopyButton text={value} label="contact" />
                </div>
                <p className={`rounded-lg px-3 py-2 text-xs ${report.consent_to_followup ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                  {report.consent_to_followup ? "They agreed to be contacted by the response team." : "They did not tick consent to be contacted. Check before reaching out."}
                </p>
              </>
            ) : (
              <p className="rounded-xl bg-paper p-3.5 text-sm text-muted">
                No contact details were given. {report.consent_to_followup ? "They agreed to follow-up, but left no way to reach them." : "They did not ask to be contacted."} Use the account below to reply through the platform.
              </p>
            )}
          </section>

          {/* Reporter */}
          <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><User className="h-4 w-4 text-purple" />Reporter</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={profile?.is_anonymous ? "outline" : "info"}>{profile?.is_anonymous ? "Anonymous" : "Signed-in account"}</Badge>
              <Badge variant="secondary">{titleCase((report.reporter_type as string) ?? "")}</Badge>
              {profile?.account_kind && <Badge variant="outline">{titleCase(profile.account_kind)}</Badge>}
            </div>
            <dl className="space-y-3">
              <Fact label="Username">{profile?.username ? <span className="font-mono">{profile.username}</span> : undefined}</Fact>
              <Fact label="Login email">{profile?.email ? <span className="break-all font-mono">{profile.email}</span> : undefined}</Fact>
              <Fact label="Filed">{report.created_at ? stamp(report.created_at as string) : undefined}</Fact>
              <Fact label="Last changed">{report.updated_at && report.updated_at !== report.created_at ? stamp(report.updated_at as string) : undefined}</Fact>
              <Fact label="Assigned to">{report.assigned_to ? staffNames.get(report.assigned_to as string) ?? "A team member" : undefined}</Fact>
            </dl>
          </section>

            </>
          )}

          {/* Assigned services */}
          <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Briefcase className="h-4 w-4 text-purple" />Assigned services</h3>
            {!assignedServices?.length ? (
              <p className="text-xs text-muted">No services assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedServices.map((s) => {
                  const svc = (Array.isArray(s.services) ? s.services[0] : s.services) as { name: string; category: string; contact_phone?: string; contact_email?: string; organization?: string } | null;
                  return (
                    <div key={s.id} className="space-y-1 rounded-xl border border-line bg-paper p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{svc?.name}</p>
                          <p className="capitalize text-muted">{svc?.category?.replace(/_/g, " ")}{svc?.organization ? ` · ${svc.organization}` : ""}</p>
                          {(svc?.contact_phone || svc?.contact_email) && (
                            <p className="mt-0.5 text-muted">{[svc.contact_phone, svc.contact_email].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                        <form action={async () => {
                          "use server";
                          const { removeService } = await import("@/app/actions/reporting-admin");
                          await removeService(id, s.service_id);
                        }}>
                          <button type="submit" aria-label="Remove service" className="text-muted transition-colors hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                      {s.note && <p className="italic text-muted">&ldquo;{s.note}&rdquo;</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <AssignServiceForm reportId={id} services={rankedServices} suggested={suggestedServices} fits={[...fittingServices]} supportRequested={supportNeeded} fromListening={fromListening} />
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Users className="h-4 w-4 text-purple" />Case timeline</h3>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {events.map((e, i) => (
                <li key={i} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-purple" aria-hidden="true" />
                  <p className="font-semibold text-ink">{e.text}</p>
                  <p className="text-muted">{stamp(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Audit trail */}
          {auditLog && auditLog.length > 0 && (
            <section className="rounded-xl border border-line bg-surface space-y-3 p-4">
              <h3 className="text-[13px] font-semibold text-ink">Who has looked</h3>
              <div className="space-y-1">
                {auditLog.map((log, i) => {
                  const p = log.profiles as { username?: string } | null;
                  return (
                    <div key={i} className="flex justify-between gap-2 border-b border-line py-1.5 text-xs last:border-0">
                      <span className="text-muted">
                        <span className="font-medium text-ink">{p?.username || "team member"}</span> · {log.action}
                      </span>
                      <span className="shrink-0 text-muted">{new Date(log.created_at!).toLocaleDateString()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

async function ReportDetailWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetail id={id} />;
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-xl bg-paper" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="h-96 animate-pulse rounded-xl bg-paper" />
          <div className="h-96 animate-pulse rounded-xl bg-paper" />
        </div>
      </div>
    }>
      <ReportDetailWrapper params={params} />
    </Suspense>
  );
}
