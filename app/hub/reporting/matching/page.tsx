import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pill } from "@/components/ui/pill";
import { MatchSimulation } from "@/components/reporting/matching/match-simulation";
import { matchMeta, summariseReport, type Tone } from "@/lib/match-state";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const metadata = { title: "Matching — WHRD Hub" };
export const dynamic = "force-dynamic";

interface Overview {
  referrals: number;
  awaiting_response: number;
  provider_accepted: number;
  accepted: number;
  declined: number;
  completed: number;
  reports_matched: number;
  reports_unmatched: number;
  stale_proposals: number;
}

interface Referral {
  id: string;
  report_id: string;
  match_status: string | null;
  match_score: number | null;
  assigned_at: string | null;
  provider_responded_at: string | null;
  survivor_responded_at: string | null;
  services: { name: string; organization: string | null; category: string } | null;
  reports: {
    id: string;
    county: string | null;
    urgency: string | null;
    status: string | null;
    incident_types: string[] | null;
    created_at: string | null;
    deleted_at: string | null;
  } | null;
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const day = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—";

function Stat({
  label, value, tone = "slate", hint,
}: { label: string; value: number; tone?: Tone; hint?: string }) {
  const bar: Record<Tone, string> = {
    amber: "bg-amber-400", green: "bg-emerald-500", cyan: "bg-cyan-500",
    red: "bg-rose-500", purple: "bg-purple", magenta: "bg-magenta", slate: "bg-slate-300",
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
      <div className={`h-1 w-8 rounded-full ${bar[tone]}`} />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function MatchingPage() {
  // Access is enforced by app/hub/reporting/layout.tsx.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const [{ data: ov }, { data: rawReferrals }] = await Promise.all([
    db.rpc("matching_overview"),
    db
      .from("report_services")
      .select(
        "id, report_id, match_status, match_score, assigned_at, provider_responded_at, survivor_responded_at, " +
          "services(name, organization, category), " +
          "reports(id, county, urgency, status, incident_types, created_at, deleted_at)",
      )
      .order("assigned_at", { ascending: false })
      .limit(400),
  ]);

  const overview = (ov ?? {}) as Partial<Overview>;

  const referrals = ((rawReferrals ?? []) as Referral[])
    .map((r) => ({ ...r, services: one(r.services), reports: one(r.reports) }))
    .filter((r) => r.reports && !r.reports.deleted_at);

  // Group by report: the console's question is "which cases are moving", and a
  // case can hold several referrals at once.
  const byReport = new Map<string, Referral[]>();
  for (const r of referrals) {
    const list = byReport.get(r.report_id) ?? [];
    list.push(r);
    byReport.set(r.report_id, list);
  }

  const cases = [...byReport.entries()]
    .map(([id, list]) => {
      const summary = summariseReport(list.map((l) => l.match_status ?? "proposed"));
      const newest = list
        .map((l) => l.assigned_at ?? "")
        .sort()
        .reverse()[0];
      return { id, list, summary, report: list[0].reports!, newest };
    })
    .sort((a, b) => {
      // Waiting cases first — they are the ones somebody has to act on.
      if (a.summary.waiting !== b.summary.waiting) return a.summary.waiting ? -1 : 1;
      return (b.newest ?? "").localeCompare(a.newest ?? "");
    });

  const stale = overview.stale_proposals ?? 0;

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-black text-ink">Matching</h1>
        <p className="text-sm text-muted">
          Every referral the engine has made, what state it is in, and a run-it-yourself
          model of how the engine decides.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Awaiting response"
          value={overview.awaiting_response ?? 0}
          tone="amber"
          hint="Matched, nobody has replied"
        />
        <Stat
          label="Service accepted"
          value={overview.provider_accepted ?? 0}
          tone="cyan"
          hint="Waiting on the survivor"
        />
        <Stat
          label="Both accepted"
          value={overview.accepted ?? 0}
          tone="green"
          hint="Survivor and service engaged"
        />
        <Stat
          label="Cases matched"
          value={overview.reports_matched ?? 0}
          tone="slate"
          hint={`${overview.reports_unmatched ?? 0} still unmatched`}
        />
      </div>

      {stale > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {stale} proposal{stale === 1 ? " has" : "s have"} been open more than 24 hours
              with no response.
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              A silent referral is indistinguishable from no referral. Open the case and
              re-run matching, or call the service directly.
            </p>
          </div>
        </div>
      )}

      {/* Live matched cases */}
      <section className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-black text-ink">Matched cases</h2>
          <p className="text-xs text-muted">
            Cases waiting on somebody are listed first.
          </p>
        </div>
        {cases.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No referrals yet. Matching runs the moment a report is filed.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {cases.slice(0, 40).map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={c.summary.tone}>{c.summary.label}</Pill>
                  <span className="text-sm font-semibold text-ink">
                    {(c.report.incident_types ?? []).slice(0, 2).join(", ").replace(/_/g, " ") ||
                      "Report"}
                  </span>
                  <span className="text-xs text-muted">{c.report.county || "county not given"}</span>
                  {c.report.urgency === "immediate" && <Pill tone="red">immediate</Pill>}
                  <span className="text-xs text-muted">filed {day(c.report.created_at)}</span>
                  <Link
                    href={`/hub/reporting/reports/${c.id}`}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-purple hover:underline"
                  >
                    Open case <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <ul className="mt-2 space-y-1">
                  {c.list.map((r) => {
                    const meta = matchMeta(r.match_status);
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted">→</span>
                        <span className="font-semibold text-ink">
                          {r.services?.name ?? "Service"}
                        </span>
                        <span className="text-muted">{r.services?.category}</span>
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                        {typeof r.match_score === "number" && (
                          <span className="font-mono text-muted">score {r.match_score}</span>
                        )}
                        {meta.waiting !== "nobody" && (
                          <span className="text-muted">waiting on the {meta.waiting}</span>
                        )}
                        <span className="ml-auto text-muted">{day(r.assigned_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The simulation */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-ink">How a match is decided</h2>
          <p className="text-sm text-muted">
            The same pipeline the database runs, stepped through on a worked example. Nothing
            here touches real cases.
          </p>
        </div>
        <MatchSimulation />
      </section>
    </div>
  );
}
