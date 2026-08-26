import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 15;

const URGENCY_BADGE: Record<string, "destructive" | "warning" | "secondary"> = {
  immediate: "destructive", within_week: "warning", no_rush: "secondary",
};
const VERIFICATION_BADGE: Record<string, "info" | "success" | "destructive" | "warning" | "secondary"> = {
  pending: "info", verified: "success", unverified: "destructive", needs_more_info: "warning",
};
const STATUS_BADGE: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  submitted: "secondary", under_review: "info", referred: "success", closed: "secondary", flagged: "destructive",
};
const CHANNEL_BADGE: Record<string, "secondary" | "info" | "success" | "warning"> = {
  web: "secondary", ussd: "warning", api: "info", mobile: "success",
};

async function ReportsTable({ page, county, urgency, verif, reporter, channel, selfOnly, currentUserId }: {
  page: number; county?: string; urgency?: string; verif?: string; reporter?: string; channel?: string;
  selfOnly?: boolean; currentUserId?: string;
}) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("reports")
    .select("id, incident_types, status, urgency, verification_status, reporter_type, county, created_at, perpetrator_type, consent_to_followup, channel", { count: "exact" })
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

  const { data: reports, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (county) params.set("county", county);
    if (urgency) params.set("urgency", urgency);
    if (verif) params.set("verif", verif);
    if (reporter) params.set("reporter", reporter);
    if (channel) params.set("channel", channel);
    if (selfOnly) params.set("self", "1");
    return `/hub/reporting/reports?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-paper">
              <TableHead>Date</TableHead>
              <TableHead>Incident Types</TableHead>
              <TableHead>County</TableHead>
              <TableHead>Perpetrator</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Fact-Check</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!reports?.length ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted py-12">No reports found</TableCell>
              </TableRow>
            ) : reports.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted whitespace-nowrap">
                  {new Date(r.created_at!).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(r.incident_types as string[]).slice(0, 2).map(t => (
                      <span key={t} className="text-xs bg-paper px-1.5 py-0.5 rounded text-muted">{t.replace(/_/g, " ")}</span>
                    ))}
                    {(r.incident_types as string[]).length > 2 && <span className="text-xs text-muted">+{(r.incident_types as string[]).length - 2}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.county || "-"}</TableCell>
                <TableCell className="text-xs text-muted">{r.perpetrator_type?.replace(/_/g, " ") || "-"}</TableCell>
                <TableCell>
                  <Badge variant={(r.urgency && URGENCY_BADGE[r.urgency]) || "secondary"}>
                    {r.urgency?.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={(r.verification_status && VERIFICATION_BADGE[r.verification_status]) || "secondary"}>
                    {r.verification_status?.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={(r.status && STATUS_BADGE[r.status]) || "secondary"}>
                    {r.status?.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={CHANNEL_BADGE[r.channel ?? "web"] || "secondary"} className="uppercase">
                    {r.channel ?? "web"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={r.reporter_type === "anonymous" ? "outline" : "info"}>
                    {r.reporter_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/hub/reporting/reports/${r.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Showing {from + 1}–{Math.min(from + PAGE_SIZE, count ?? 0)} of {count} reports
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(page - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Link>
              </Button>
            )}
            <span className="text-sm text-muted flex items-center px-2">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(page + 1)}>Next<ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function AdminReportsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1"));
  const county = sp.county;
  const urgency = sp.urgency;
  const verif = sp.verif;
  const reporter = sp.reporter;
  const channel = sp.channel;
  const selfOnly = sp.self === "1";

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data: counties } = await supabase
    .from("reports")
    .select("county")
    .not("county", "is", null)
    .is("deleted_at", null);
  const uniqueCounties = [...new Set((counties ?? []).map(r => r.county).filter(Boolean))].sort();

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink mb-1">All Reports</h1>
        <p className="text-muted text-sm">Review, filter, and fact-check incoming reports.</p>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl border border-line p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">County</label>
          <select name="county" defaultValue={county || ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All counties</option>
            {uniqueCounties.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Urgency</label>
          <select name="urgency" defaultValue={urgency || ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All</option>
            <option value="immediate">Immediate</option>
            <option value="within_week">Within Week</option>
            <option value="no_rush">No Rush</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Fact-Check Status</label>
          <select name="verif" defaultValue={verif || ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="needs_more_info">Needs More Info</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Reporter Type</label>
          <select name="reporter" defaultValue={reporter || ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All</option>
            <option value="anonymous">Anonymous</option>
            <option value="authenticated">Authenticated</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Channel</label>
          <select name="channel" defaultValue={channel || ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All channels</option>
            <option value="web">Web</option>
            <option value="ussd">USSD</option>
            <option value="mobile">Mobile</option>
            <option value="api">API</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">View</label>
          <select name="self" defaultValue={selfOnly ? "1" : ""} className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
            <option value="">All reports</option>
            <option value="1">My self-reports</option>
          </select>
        </div>
        <input type="hidden" name="page" value="1" />
        <Button type="submit" size="sm">Apply Filters</Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/hub/reporting/reports">Clear</Link>
        </Button>
      </form>

      {selfOnly && (
        <div className="flex items-center gap-2 text-sm bg-purple/5 border border-purple/20 text-purple px-4 py-2.5 rounded-xl">
          <span className="font-semibold">Showing your self-reports only.</span>
          <Link href="/hub/reporting/reports" className="underline text-xs">Show all</Link>
        </div>
      )}

      <Suspense fallback={<div className="bg-white rounded-xl border border-line p-12 text-center text-muted animate-pulse">Loading reports...</div>}>
        <ReportsTable
          page={page} county={county} urgency={urgency} verif={verif} reporter={reporter} channel={channel}
          selfOnly={selfOnly} currentUserId={currentUserId}
        />
      </Suspense>
    </div>
  );
}

export default function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
      <AdminReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
