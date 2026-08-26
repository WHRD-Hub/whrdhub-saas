import Link from "next/link";
import { ShieldCheck, ChevronRight, Inbox, AlertTriangle, Megaphone } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { getServerLanguage } from "@/lib/i18n/server";
import { translations } from "@/lib/i18n/translations";

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "slate" | "cyan"> = {
  submitted: "amber",
  under_review: "cyan",
  referred: "green",
  closed: "slate",
  flagged: "red",
};

export const metadata = { title: "My Reports — WHRD Hub" };

export default async function MemberReportsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: reports }, { data: profile }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, incident_types, county, status, verification_status, urgency, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("preferred_language").eq("id", user!.id).maybeSingle(),
  ]);

  const lang = await getServerLanguage(profile?.preferred_language as string | null);
  const td = translations[lang].dashboard;

  const STATUS_LABEL: Record<string, string> = {
    submitted: td.statusSubmitted,
    under_review: td.statusUnderReview,
    referred: td.statusReferred,
    closed: td.statusClosed,
    flagged: td.statusFlagged,
  };

  // A report counts as "acted on" once support services have been attached.
  const ids = (reports ?? []).map((r) => r.id as string);
  const actioned = new Set<string>();
  if (ids.length) {
    const { data: rs } = await supabase
      .from("report_services")
      .select("report_id")
      .in("report_id", ids);
    for (const r of rs ?? []) actioned.add(r.report_id as string);
  }

  const list = reports ?? [];
  const withUpdates = list.filter(
    (r) => actioned.has(r.id as string) || (r.status && r.status !== "submitted"),
  ).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
            <ShieldCheck className="h-6 w-6 text-purple" /> My reports
          </h1>
          <p className="mt-1 text-sm text-muted">
            Everything you have filed, and what has happened since. Only you and the
            Hub&apos;s response team can see this.
          </p>
        </div>
        <Link
          href="/report"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-magenta px-4 text-sm font-bold text-white transition-[filter] hover:brightness-95"
        >
          <Megaphone className="h-4 w-4" /> Make a report
        </Link>
      </div>

      {withUpdates > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-900">
            <span className="font-bold">{withUpdates}</span> of your reports{" "}
            {withUpdates === 1 ? "has" : "have"} an update or assigned support.
          </p>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-purple" />
          <p className="mt-3 font-semibold text-ink">No reports yet</p>
          <p className="mt-1 text-sm text-muted">
            If you ever need to report abuse, it stays private and secure.
          </p>
          <Link
            href="/report"
            className="mt-4 inline-flex rounded-xl bg-magenta px-5 py-2.5 text-sm font-bold text-white"
          >
            Report abuse
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((r) => {
            const hasAction =
              actioned.has(r.id as string) || (r.status && r.status !== "submitted");
            const status = (r.status as string) ?? "submitted";
            return (
              <Link
                key={r.id as string}
                href={`/dashboard/reports/${r.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {(r.incident_types as string[])?.map((t) => t.replace(/_/g, " ")).join(", ") ||
                      "Report"}
                    {r.county ? ` · ${r.county}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Filed {timeAgo(r.created_at as string)}
                    {r.urgency === "immediate" ? " · Marked urgent" : ""}
                  </p>
                </div>
                {hasAction && <Pill tone="green">Action taken</Pill>}
                <Pill tone={STATUS_TONE[status] ?? "slate"}>
                  {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
                </Pill>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
