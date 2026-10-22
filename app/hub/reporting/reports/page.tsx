import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReportRow, type ReportSummary } from "@/components/reporting/report-row";
import { UrlFilterBar, type FilterDef, type Preset } from "@/components/ui/filter-bar";
import { summariseReport } from "@/lib/match-state";

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = {
  page: number; q?: string; county?: string; urgency?: string; verif?: string; reporter?: string;
  channel?: string; match?: string; selfOnly?: boolean; currentUserId?: string;
};

async function ReportsList({ page, q, county, urgency, verif, reporter, channel, match, selfOnly, currentUserId }: Params) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  // A match filter has to join through report_services, so the embed becomes an
  // inner join. The referral states shown on each row are then re-fetched
  // separately below, otherwise the join would only hand back the referrals
  // that matched the filter and the row would understate the case.
  const columns = "id, incident_types, status, urgency, verification_status, reporter_type, county, created_at, perpetrator_type, channel";

  let query = supabase
    .from("reports")
    .select(match ? `${columns}, report_services!inner(match_status)` : columns, { count: "exact" })
    // Deleted cases live in /hub/reporting/deleted.
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (county) query = query.eq("county", county);
  if (urgency) query = query.eq("urgency", urgency as "immediate" | "within_week" | "no_rush");
  if (verif) query = query.eq("verification_status", verif as "pending" | "verified" | "unverified" | "needs_more_info");
  if (reporter) query = query.eq("reporter_type", reporter as "anonymous" | "authenticated");
  if (channel) query = query.eq("channel", channel as "web" | "ussd" | "api" | "mobile");
  if (selfOnly && currentUserId) query = query.eq("user_id", currentUserId);
  if (match) query = query.eq("report_services.match_status", match);

  // Search: a pasted case ID, or words from what was reported and where.
  if (q) {
    if (UUID.test(q)) query = query.eq("id", q);
    else {
      // Characters that mean something inside a PostgREST filter are dropped rather than escaped.
      const safe = q.replace(/[,()%*\\]/g, " ").trim();
      if (safe) query = query.or(`description.ilike.%${safe}%,county.ilike.%${safe}%,location_description.ilike.%${safe}%,perpetrator_detail.ilike.%${safe}%`);
    }
  }

  const { data: rawReports, count } = await query;
  const reports = (rawReports ?? []) as unknown as ReportSummary[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Referral states for the rows on this page, in one round trip.
  const states = new Map<string, string[]>();
  if (reports.length) {
    const { data: refs } = await supabase.from("report_services").select("report_id, match_status").in("report_id", reports.map((r) => r.id));
    for (const r of (refs ?? []) as { report_id: string; match_status: string | null }[]) {
      const list = states.get(r.report_id) ?? [];
      list.push(r.match_status ?? "proposed");
      states.set(r.report_id, list);
    }
  }

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (q) params.set("q", q);
    if (county) params.set("county", county);
    if (urgency) params.set("urgency", urgency);
    if (verif) params.set("verif", verif);
    if (reporter) params.set("reporter", reporter);
    if (channel) params.set("channel", channel);
    if (match) params.set("match", match);
    if (selfOnly) params.set("self", "1");
    return `/hub/reporting/reports?${params}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/60 px-4 py-2 text-xs text-muted">
        <span>
          {total === 0 ? "No reports" : <>Showing <span className="font-semibold text-ink">{from + 1}–{Math.min(from + PAGE_SIZE, total)}</span> of {total}</>}
        </span>
        {totalPages > 1 && (
          <span className="flex items-center gap-1">
            {page > 1 ? <Link href={buildUrl(page - 1)} aria-label="Previous page" className="rounded-md p-1 hover:bg-surface hover:text-ink"><ChevronLeft className="h-4 w-4" /></Link> : <span className="p-1 opacity-30"><ChevronLeft className="h-4 w-4" /></span>}
            <span>Page {page} of {totalPages}</span>
            {page < totalPages ? <Link href={buildUrl(page + 1)} aria-label="Next page" className="rounded-md p-1 hover:bg-surface hover:text-ink"><ChevronRight className="h-4 w-4" /></Link> : <span className="p-1 opacity-30"><ChevronRight className="h-4 w-4" /></span>}
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="grid place-items-center px-6 py-16 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-050 text-purple"><SearchX className="h-5 w-5" /></span>
          <p className="mt-3 font-semibold text-ink">No reports match</p>
          <p className="mt-1 text-sm text-muted">Try a different word, or clear a filter.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id}><ReportRow r={r} match={states.has(r.id) ? summariseReport(states.get(r.id) ?? []) : null} /></li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs">
          {page > 1 ? <Link href={buildUrl(page - 1)} className="font-semibold text-purple hover:underline">← Newer</Link> : <span />}
          {page < totalPages ? <Link href={buildUrl(page + 1)} className="font-semibold text-purple hover:underline">Older →</Link> : <span />}
        </div>
      )}
    </div>
  );
}

const FILTERS = (counties: string[]): FilterDef[] => [
  { key: "county", label: "County", options: counties.map((c) => ({ value: c, label: c })) },
  { key: "urgency", label: "Urgency", options: [{ value: "immediate", label: "Immediate" }, { value: "within_week", label: "Within a week" }, { value: "no_rush", label: "No rush" }] },
  { key: "verif", label: "Fact-check", options: [{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "unverified", label: "Could not verify" }, { value: "needs_more_info", label: "Needs more info" }] },
  { key: "match", label: "Matching", options: [
    { value: "proposed", label: "Matched, no reply" },
    { value: "provider_accepted", label: "Service accepted" },
    { value: "accepted", label: "Both accepted" },
    { value: "declined", label: "Declined" },
    { value: "completed", label: "Completed" },
  ] },
  { key: "channel", label: "Channel", options: [{ value: "web", label: "Web" }, { value: "ussd", label: "USSD" }, { value: "mobile", label: "Mobile" }, { value: "api", label: "Online listening" }] },
  { key: "reporter", label: "Reporter", options: [{ value: "anonymous", label: "Anonymous" }, { value: "authenticated", label: "With an account" }] },
];

async function AdminReportsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1") || 1);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const selfOnly = sp.self === "1";

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const head = () => supabase.from("reports").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const [{ data: counties }, urgent, pending, needsInfo, mine] = await Promise.all([
    supabase.from("reports").select("county").not("county", "is", null).is("deleted_at", null),
    head().eq("urgency", "immediate"),
    head().eq("verification_status", "pending"),
    head().eq("verification_status", "needs_more_info"),
    currentUserId ? head().eq("user_id", currentUserId) : Promise.resolve({ count: 0 }),
  ]);
  const uniqueCounties = [...new Set((counties ?? []).map((r) => r.county as string).filter(Boolean))].sort();

  const presets: Preset[] = [
    { id: "all", label: "All", params: {} },
    { id: "urgent", label: "Urgent", params: { urgency: "immediate" }, count: urgent.count ?? 0 },
    { id: "pending", label: "Awaiting fact-check", params: { verif: "pending" }, count: pending.count ?? 0 },
    { id: "info", label: "Needs more info", params: { verif: "needs_more_info" }, count: needsInfo.count ?? 0 },
    ...((mine.count ?? 0) > 0 ? [{ id: "mine", label: "My own reports", params: { self: "1" }, count: mine.count ?? 0 } as Preset] : []),
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Reports</h1>
        <p className="text-sm text-muted">Review, fact-check and respond to what has been reported.</p>
      </header>

      <UrlFilterBar presets={presets} filters={FILTERS(uniqueCounties)} searchPlaceholder="Search what was reported, a place, or a case ID" />

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-line bg-surface p-16 text-center text-sm text-muted">Loading reports…</div>}>
        <ReportsList
          page={page} q={q} county={sp.county} urgency={sp.urgency} verif={sp.verif} reporter={sp.reporter}
          channel={sp.channel} match={sp.match} selfOnly={selfOnly} currentUserId={currentUserId}
        />
      </Suspense>
    </div>
  );
}

export default function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
      <AdminReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
