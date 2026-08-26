import Link from "next/link";
import { Trash2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { DeletedActions } from "@/components/hub/deleted-actions";
import { getReportingAccess } from "@/lib/reporting-access";
import { redirect } from "next/navigation";

export const metadata = { title: "Deleted reports — WHRD Hub" };

/**
 * Reports the Hub has taken down. A defender never sees this: deletion, and
 * undoing it, is an administrator's decision.
 */
export default async function DeletedReportsPage() {
  const access = await getReportingAccess();
  if (!access?.canAdminister) redirect("/hub/reporting");

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select(
      "id, incident_types, county, status, verification_status, urgency, created_at, deleted_at, deleted_by, deleted_reason, user_id, channel",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const list = reports ?? [];

  const admin = createAdminClient();
  const ids = Array.from(
    new Set(list.flatMap((r) => [r.deleted_by, r.user_id]).filter(Boolean)),
  ) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await admin.from("profiles").select("id, full_name, username").in("id", ids);
    for (const p of data ?? []) {
      names.set(p.id as string, (p.full_name as string) || (p.username as string) || "Member");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
            <Trash2 className="h-6 w-6 text-purple" /> Deleted reports
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Cases removed from the triage list. The reporter can no longer see them.
            Restoring puts a case back exactly as it was.
          </p>
        </div>
        <Link
          href="/hub/reporting/reports"
          className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-purple-050"
        >
          Back to reports
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-purple" />
          <p className="mt-3 font-semibold text-ink">No reports have been deleted</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((r) => {
            const label =
              ((r.incident_types as string[]) ?? [])
                .map((t) => t.replace(/_/g, " "))
                .join(", ") || "Report";
            const deleter = r.deleted_by ? names.get(r.deleted_by as string) : null;
            return (
              <li key={r.id as string} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize text-ink">
                    {label}
                    {r.county ? ` · ${r.county as string}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="font-mono">{(r.id as string).slice(0, 8)}</span>
                    <span aria-hidden>·</span>
                    <span>filed {timeAgo(r.created_at as string)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      deleted {timeAgo(r.deleted_at as string)}
                      {deleter ? ` by ${deleter}` : ""}
                    </span>
                  </p>
                  {r.deleted_reason && (
                    <p className="mt-1 text-xs italic text-muted">
                      &ldquo;{r.deleted_reason as string}&rdquo;
                    </p>
                  )}
                </div>
                {r.urgency === "immediate" && <Pill tone="red">Was urgent</Pill>}
                <Pill tone="slate">{(r.status as string)?.replace(/_/g, " ")}</Pill>
                <DeletedActions target={{ type: "report", id: r.id as string, label }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
