import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Shield, CheckCircle, XCircle, HelpCircle, MapPin, Calendar, User, AlertTriangle, Briefcase, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FactCheckForm } from "@/components/reporting/admin/fact-check-form";
import { AssignServiceForm } from "@/components/reporting/admin/assign-service-form";
import { ReportDelete } from "@/components/reporting/admin/report-delete";
import { getReportingAccess } from "@/lib/reporting-access";

const VERIFICATION_META: Record<string, { label: string; icon: React.ReactNode; variant: "info" | "success" | "destructive" | "warning" }> = {
  pending:         { label: "Pending Fact-Check", icon: <HelpCircle className="w-4 h-4" />, variant: "info" },
  verified:        { label: "Verified - Credible", icon: <CheckCircle className="w-4 h-4" />, variant: "success" },
  unverified:      { label: "Could Not Verify", icon: <XCircle className="w-4 h-4" />, variant: "destructive" },
  needs_more_info: { label: "Needs More Info", icon: <AlertTriangle className="w-4 h-4" />, variant: "warning" },
};

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm ${mono ? "font-mono bg-paper px-2 py-1 rounded" : ""}`}>{value}</p>
    </div>
  );
}

async function ReportDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const access = await getReportingAccess();
  const canAdminister = !!access?.canAdminister;

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) notFound();

  // reports.user_id references auth.users, not profiles - fetch profile separately.
  const { data: profileData } = report.user_id
    ? await supabase.from("profiles").select("username, is_anonymous, email, user_type").eq("id", report.user_id).single()
    : { data: null };

  const { data: assignedServices } = await supabase
    .from("report_services")
    .select("id, note, service_id, services(name, category, contact_phone, contact_email, organization)")
    .eq("report_id", id);

  const { data: allServices } = await supabase
    .from("services")
    .select("id, name, category, organization")
    .eq("is_active", true)
    .order("category");

  const { data: auditLog } = await supabase
    .from("report_audit_log")
    .select("action, created_at, profiles!report_audit_log_viewed_by_fkey(username)")
    .eq("report_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const vm = (report.verification_status && VERIFICATION_META[report.verification_status]) || VERIFICATION_META.pending;
  const profile = profileData as { username?: string; is_anonymous?: boolean; email?: string; user_type?: string } | null;

  // Log the view
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (user) {
    await supabase.from("report_audit_log").insert({ report_id: id, viewed_by: user.id, action: "viewed" });
  }

  const assignedServiceIds = new Set((assignedServices ?? []).map(s => s.service_id));

  // ─── Auto-match services to the support the reporter asked for ──────────────
  // support_needed values line up with service categories (legal, medical,
  // psychosocial, shelter, digital_security, financial, referral). We also map a
  // couple of near-synonyms so admins get relevant suggestions without having to
  // cycle through every service manually.
  const SUPPORT_TO_CATEGORIES: Record<string, string[]> = {
    legal: ["legal"],
    medical: ["medical"],
    psychosocial: ["psychosocial"],
    counselling: ["psychosocial"],
    shelter: ["shelter"],
    digital_security: ["digital_security"],
    financial: ["financial"],
    referral: ["referral"],
    other: ["referral", "other"],
  };

  const supportNeeded = (report.support_needed as string[]) ?? [];
  const matchedCategories = new Set(
    supportNeeded.flatMap(s => SUPPORT_TO_CATEGORIES[s] ?? [s])
  );

  const unassignedServices = (allServices ?? []).filter(s => !assignedServiceIds.has(s.id));
  const suggestedServices = unassignedServices.filter(s => matchedCategories.has(s.category));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back */}
      <Link href="/hub/reporting/reports" className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink mb-2">Report Detail</h1>
          <p className="font-mono text-xs text-muted">{report.id}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={vm.variant} className="flex items-center gap-1">
            {vm.icon} {vm.label}
          </Badge>
          <Badge variant="secondary">{report.status?.replace(/_/g, " ")}</Badge>
          {report.urgency === "immediate" && <Badge variant="destructive">IMMEDIATE URGENCY</Badge>}
          {canAdminister && <ReportDelete reportId={report.id as string} />}
        </div>
      </div>

      {report.deleted_at ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-bold">This report is deleted.</span> The reporter can no
            longer see it. Restore it from Deleted reports.
            {report.deleted_reason ? ` Reason: ${report.deleted_reason as string}` : ""}
          </span>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main report content */}
        <div className="lg:col-span-2 space-y-5">
          {/* 5Ws+H */}
          <div className="bg-white rounded-xl border border-line p-6 space-y-5">
            <h2 className="font-bold text-base flex items-center gap-2"><Shield className="w-4 h-4 text-purple" />Incident Details (5Ws + H)</h2>

            <div>
              <p className="text-xs font-semibold text-muted uppercase mb-1.5">WHAT - Incident Types</p>
              <div className="flex flex-wrap gap-1.5">
                {(report.incident_types as string[]).map(t => (
                  <Badge key={t} variant="outline">{t.replace(/_/g, " ")}</Badge>
                ))}
              </div>
            </div>

            <Field label="WHAT - Description" value={report.description} />

            {report.tfgbv_platform && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                <p className="text-xs font-bold text-amber-900 uppercase">TFGBV Evidence</p>
                <Field label="Platform" value={report.tfgbv_platform} />
                {report.tfgbv_link && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase mb-1">Link / URL</p>
                    <a href={report.tfgbv_link} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-purple hover:underline flex items-center gap-1 break-all">
                      {report.tfgbv_link} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
                <Field label="Content / Text" value={report.tfgbv_content_text} />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-1.5 flex items-center gap-1"><User className="w-3.5 h-3.5" />WHO - Perpetrator</p>
                <p className="text-sm font-medium">{report.perpetrator_type?.replace(/_/g, " ") || "Not specified"}</p>
                {report.perpetrator_detail && <p className="text-xs text-muted mt-0.5">{report.perpetrator_detail}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-1.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />WHERE</p>
                <p className="text-sm">{report.county || "-"}</p>
                {report.location_description && <p className="text-xs text-muted">{report.location_description}</p>}
                {report.latitude && (
                  <a href={`https://maps.google.com/?q=${report.latitude},${report.longitude}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-purple hover:underline mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{report.latitude.toFixed(5)}, {report.longitude?.toFixed(5)} ↗
                  </a>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted uppercase mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />WHEN</p>
              <p className="text-sm">
                {report.occurred_at ? new Date(report.occurred_at).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date not provided"}
                {report.occurred_time && ` at ${report.occurred_time}`}
                {report.is_ongoing && <Badge variant="warning" className="ml-2">Ongoing</Badge>}
              </p>
            </div>

            <Field label="HOW - Method / Description" value={report.how_description} />
            {(report.evidence_types?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-1.5">Evidence available</p>
                <div className="flex flex-wrap gap-1.5">
                  {(report.evidence_types as string[]).map(e => <Badge key={e} variant="info">{e.replace(/_/g, " ")}</Badge>)}
                </div>
              </div>
            )}

            {(report.activism_context || report.how_description) && (
              <Field label="WHY - Activism Context" value={report.activism_context} />
            )}
          </div>

          {/* Support requested */}
          <div className="bg-white rounded-xl border border-line p-6 space-y-3">
            <h2 className="font-bold text-base">Support Requested</h2>
            <div className="flex flex-wrap gap-1.5">
              {(report.support_needed as string[]).map(s => <Badge key={s} variant="secondary">{s.replace(/_/g, " ")}</Badge>)}
            </div>
            {report.consent_to_followup && (
              <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="font-semibold text-green-800 mb-1">Consented to follow-up</p>
                <p className="text-green-700">Via {report.contact_method || "-"}: {report.contact_value || "-"}</p>
              </div>
            )}
          </div>

          {/* Fact-check form */}
          <FactCheckForm
            reportId={id}
            currentStatus={report.verification_status ?? "pending"}
            currentNotes={report.verification_notes}
            currentIncidentTypes={report.incident_types as string[]}
            currentAttackNature={report.attack_nature}
            currentDerogatoryWords={report.derogatory_words as string[] | undefined}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Reporter info */}
          <div className="bg-white rounded-xl border border-line p-5 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><User className="w-4 h-4 text-purple" />Reporter</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={profile?.is_anonymous ? "outline" : "info"}>
                  {profile?.is_anonymous ? "Anonymous" : "Authenticated"}
                </Badge>
                <Badge variant="secondary">{report.reporter_type}</Badge>
              </div>
              {profile?.username && <Field label="Username" value={profile.username} mono />}
              {profile?.email && <Field label="Login Email" value={profile.email} mono />}
              <Field label="Reporting for" value={report.reporting_for?.replace(/_/g, " ")} />
              <Field label="Channel" value={report.channel} />
              <p className="text-xs text-muted">
                Submitted {new Date(report.created_at!).toLocaleString("en-KE")}
              </p>
            </div>
          </div>

          {/* Assigned services */}
          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple" />Assigned Services</h3>
            {!assignedServices?.length ? (
              <p className="text-xs text-muted">No services assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedServices.map(s => {
                  const svc = (Array.isArray(s.services) ? s.services[0] : s.services) as { name: string; category: string; contact_phone?: string; contact_email?: string; organization?: string } | null;
                  return (
                    <div key={s.id} className="p-3 rounded-lg bg-paper border border-line text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{svc?.name}</p>
                          <p className="text-muted capitalize">{svc?.category} · {svc?.organization}</p>
                        </div>
                        <form action={async () => {
                          "use server";
                          const { removeService } = await import("@/app/actions/reporting-admin");
                          await removeService(id, s.service_id);
                        }}>
                          <button type="submit" className="text-muted hover:text-rose-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                      {s.note && <p className="text-muted italic">&ldquo;{s.note}&rdquo;</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <AssignServiceForm
              reportId={id}
              services={unassignedServices}
              suggested={suggestedServices}
              supportRequested={supportNeeded}
            />
          </div>

          {/* Audit log */}
          {auditLog && auditLog.length > 0 && (
            <div className="bg-white rounded-xl border border-line p-5 space-y-3">
              <h3 className="font-bold text-sm">Audit Trail</h3>
              <div className="space-y-2">
                {auditLog.map((log, i) => {
                  const p = log.profiles as { username?: string } | null;
                  return (
                    <div key={i} className="text-xs flex justify-between gap-2 py-1 border-b border-line last:border-0">
                      <span className="text-muted">
                        <span className="font-medium text-ink">{p?.username || "defender"}</span> - {log.action}
                      </span>
                      <span className="text-muted shrink-0">{new Date(log.created_at!).toLocaleDateString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading report...</div>}>
      <ReportDetailWrapper params={params} />
    </Suspense>
  );
}
