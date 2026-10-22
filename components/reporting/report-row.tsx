import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { incidentLabel } from "@/lib/reporting-options";
import { urgencyMeta } from "@/lib/urgency";
import { timeAgo } from "@/lib/utils";

export interface ReportSummary {
  id: string;
  incident_types: string[] | null;
  status: string | null;
  urgency: string | null;
  verification_status: string | null;
  reporter_type: string | null;
  county?: string | null;
  created_at: string | null;
  perpetrator_type?: string | null;
  channel?: string | null;
}

const VERIF: Record<string, { tone: "cyan" | "green" | "red" | "amber"; label: string }> = {
  pending: { tone: "cyan", label: "Fact-check pending" },
  verified: { tone: "green", label: "Verified" },
  unverified: { tone: "red", label: "Could not verify" },
  needs_more_info: { tone: "amber", label: "Needs more info" },
};
const CHANNEL: Record<string, string> = { web: "Web", ussd: "USSD", mobile: "Mobile", api: "Online listening" };

/**
 * A report on a single line: what it is, where, how long ago, and the few
 * states that matter, with the whole row a link. This replaces an eleven-column
 * table that scrolled sideways and spent three lines on every report.
 */
export function ReportRow({ r, match }: { r: ReportSummary; match?: { label: string; tone: "amber" | "green" | "red" | "slate" | "purple" | "cyan" | "magenta" } | null }) {
  const u = urgencyMeta(r.urgency);
  const types = r.incident_types ?? [];
  const title = types.length ? types.slice(0, 2).map(incidentLabel).join(" · ") + (types.length > 2 ? ` +${types.length - 2}` : "") : "Report";
  const v = VERIF[r.verification_status ?? "pending"] ?? VERIF.pending;
  const detail = [
    r.county,
    r.perpetrator_type ? r.perpetrator_type.replace(/_/g, " ") : null,
    r.created_at ? timeAgo(r.created_at) : null,
    CHANNEL[r.channel ?? "web"],
    r.reporter_type === "anonymous" ? "Anonymous" : null,
  ].filter(Boolean).join(" · ");

  return (
    <Link href={`/hub/reporting/reports/${r.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper sm:gap-4">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: u.hex }} title={`${u.label} urgency`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 truncate text-xs capitalize text-muted">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Pill tone={u.tone}>{u.label}</Pill>
        <span className="hidden items-center gap-1.5 md:flex">
          <Pill tone={v.tone}>{v.label}</Pill>
          {match && <Pill tone={match.tone}>{match.label}</Pill>}
          {r.status && r.status !== "submitted" && <Pill tone="slate">{r.status.replace(/_/g, " ")}</Pill>}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
