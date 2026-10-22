import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pill } from "@/components/ui/pill";
import { STATUS_LABEL, STATUS_TONE, type MentorDoc, type MentorStatus } from "@/lib/mentor-verification";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Mentors — WHRD Hub" };

const FILTERS: { id: "all" | MentorStatus; label: string }[] = [
  { id: "under_review", label: "To review" },
  { id: "rejected", label: "Needs attention" },
  { id: "verified", label: "Verified" },
  { id: "not_submitted", label: "No documents" },
  { id: "all", label: "Everyone" },
];

/**
 * Every femtor, with where their verification stands. Admins open one to see the
 * documents they sent and their answers, and to verify them or send them back.
 */
export default async function MentorsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.id === sp.status) ? (sp.status as "all" | MentorStatus) : "under_review";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const { data: mentors } = await db.from("mentorship_profiles").select("user_id, support_offered, updated_at").eq("is_mentor", true);
  const ids = ((mentors ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const [{ data: people }, { data: vers }] = ids.length
    ? await Promise.all([
        db.from("profiles").select("id, full_name, username, title, avatar_url").in("id", ids),
        db.from("mentor_verifications").select("user_id, status, documents, submitted_at").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const name = new Map<string, { name: string; title: string | null }>(
    ((people ?? []) as { id: string; full_name: string | null; username: string | null; title: string | null }[]).map((p) => [p.id, { name: p.full_name || p.username || "Member", title: p.title }]),
  );
  const ver = new Map<string, { status: MentorStatus; documents: MentorDoc[]; submitted_at: string | null }>(
    ((vers ?? []) as { user_id: string; status: MentorStatus; documents: MentorDoc[]; submitted_at: string | null }[]).map((v) => [v.user_id, v]),
  );

  const rows = ids.map((id) => ({ id, ...(name.get(id) ?? { name: "Member", title: null }), v: ver.get(id) ?? { status: "not_submitted" as MentorStatus, documents: [], submitted_at: null } }));
  const count = (f: "all" | MentorStatus) => (f === "all" ? rows.length : rows.filter((r) => r.v.status === f).length);
  const shown = rows
    .filter((r) => filter === "all" || r.v.status === filter)
    .sort((a, b) => (b.v.submitted_at ?? "").localeCompare(a.v.submitted_at ?? "") || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink"><ShieldCheck className="h-5 w-5 text-purple" /> Mentors</h1>
        <p className="mt-1 text-sm text-muted">Femtors who offer guidance, and the ID and accreditation they have sent. Documents are optional for them; verifying is your call.</p>
      </header>

      <div role="tablist" aria-label="Verification status" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-paper p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            href={f.id === "under_review" ? "/hub/mentors" : `/hub/mentors?status=${f.id}`}
            className={cn("shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold", filter === f.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {f.label}<span className="ml-1.5 text-[11px] font-bold text-muted">{count(f.id)}</span>
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">No mentors here.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/hub/mentors/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="truncate text-xs text-muted">{r.title || "No title given"}</p>
                </div>
                <span className="hidden text-xs text-muted sm:block">
                  {r.v.documents.length ? `${r.v.documents.length} document${r.v.documents.length === 1 ? "" : "s"}` : "No documents"}
                  {r.v.submitted_at ? ` · sent ${timeAgo(r.v.submitted_at)}` : ""}
                </span>
                <Pill tone={STATUS_TONE[r.v.status]}>{STATUS_LABEL[r.v.status]}</Pill>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
