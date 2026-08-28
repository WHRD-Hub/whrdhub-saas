import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PenLine, Building2, Heart, FileText, BookOpen, ShieldCheck,
  AlertTriangle, ArrowRight,
} from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { CardSkeleton, RowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import { CONTENT_STATUS_META, VERIF_STATUS_META } from "@/lib/data";
import { PostComposerModal } from "@/components/composer/post-composer-modal";
import { matchMeta, summariseReport } from "@/lib/match-state";

export const metadata = { title: "Dashboard — WHRD Hub" };

/**
 * One dashboard.
 *
 * The community side and the reporting side used to be separate places, which
 * meant a defender who had filed a report had to remember a second dashboard
 * existed to find out whether anyone had answered it. Her reports now sit on
 * the same page as everything else, showing status and whether support has
 * actually been matched and taken up.
 *
 * The page is a static shell with four independent panels streamed into it.
 * Nothing waits on anything else: the greeting and layout paint immediately,
 * and each panel arrives when its query returns, so one slow count cannot hold
 * the whole page hostage.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Anonymous reporter accounts have no community profile — their dashboard is
  // the reports list.
  if (user?.isReporterOnly) redirect("/dashboard/reports");

  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "there";
  const uid = user!.id;

  return (
    <>
      {/* Static shell — no data, so it paints on the first byte. */}
      <div className="mb-6 rounded-2xl border border-line bg-gradient-to-br from-[#fdf1e7] via-magenta-050 to-purple-050 p-6 sm:p-7">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Karibu, {name} 👋</h1>
        <p className="mt-1 text-ink/70">Welcome back, ready to make a difference?</p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Suspense fallback={<CardSkeleton />}>
          <PostComposerModal
            variant="card"
            isHub={!!user?.profile?.is_hub_admin}
            userName={name}
            avatarUrl={user?.profile?.avatar_url}
          />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <ReportsCard uid={uid} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <FemtorshipCard uid={uid} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <OrganisationCard />
        </Suspense>
      </div>

      <div className="mt-6 space-y-6">
        <Suspense fallback={<PanelSkeleton title="Your reports" />}>
          <ReportsPanel uid={uid} />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Your submissions" />}>
          <SubmissionsPanel uid={uid} />
        </Suspense>
      </div>
    </>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-ink">{title}</h2>
        <Skeleton className="h-4 w-20" />
      </div>
      <RowsSkeleton />
    </section>
  );
}

/* ── Cards ─────────────────────────────────────────────────────────────── */

async function ReportsCard({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, status")
    .eq("user_id", uid)
    .is("deleted_at", null);

  const list = data ?? [];
  const actioned = list.filter((r) => r.status && r.status !== "submitted").length;

  return (
    <Link href="/dashboard/reports" className="block">
      <div className="h-full rounded-2xl bg-cyan-050 p-5 transition-shadow hover:shadow-md">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-cyan-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <p className="mt-3 truncate font-bold text-ink">
          {list.length} report{list.length === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-ink/60">
          {actioned > 0 ? `${actioned} with updates` : "Private to you"}
        </p>
      </div>
    </Link>
  );
}

async function FemtorshipCard({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentorship_matches")
    .select("id")
    .or(`mentor_id.eq.${uid},mentee_id.eq.${uid}`);
  const n = data?.length ?? 0;

  return (
    <Link href="/mentorship" className="block">
      <div className="h-full rounded-2xl bg-magenta-050 p-5 transition-shadow hover:shadow-md">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-magenta-700">
          <Heart className="h-5 w-5" />
        </div>
        <p className="mt-3 font-bold text-ink">{n} match{n === 1 ? "" : "es"}</p>
        <p className="text-xs text-ink/60">Femtorship</p>
      </div>
    </Link>
  );
}

async function OrganisationCard() {
  const user = await getCurrentUser();
  const org = user?.membership?.organizations;

  return (
    <Link href={org ? "/profile" : "/dashboard/network/join"} className="block">
      <div className="h-full rounded-2xl bg-purple-050 p-5 transition-shadow hover:shadow-md">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-purple">
          <Building2 className="h-5 w-5" />
        </div>
        <p className="mt-3 truncate font-bold text-ink">{org?.name ?? "No organisation"}</p>
        {org ? (
          <div className="mt-1">
            <Pill tone={VERIF_STATUS_META[org.verification_status]?.tone ?? "slate"}>
              {VERIF_STATUS_META[org.verification_status]?.label ?? org.verification_status}
            </Pill>
          </div>
        ) : (
          <p className="text-xs text-ink/60">Join one to post &amp; publish →</p>
        )}
      </div>
    </Link>
  );
}

/* ── Panels ────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "slate" | "cyan"> = {
  submitted: "amber", under_review: "cyan", referred: "green", closed: "slate", flagged: "red",
};

/**
 * Her reports, with the thing she actually wants to know: has anyone answered.
 *
 * Status alone does not say that. A report can read "referred" while every
 * service it was matched to has stayed silent, so the match state is shown
 * beside it — and where a service is waiting on her, that is said plainly,
 * because a person cannot act on a signal she never sees.
 */
async function ReportsPanel({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, incident_types, county, status, created_at, report_services(match_status)")
    .eq("user_id", uid)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const reports = (data ?? []) as unknown as {
    id: string; incident_types: string[] | null; county: string | null;
    status: string | null; created_at: string;
    report_services: { match_status: string | null }[] | null;
  }[];

  if (reports.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-black text-ink">Your reports</h2>
        <div className="py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-050 text-cyan-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-muted">
            You have not filed a report. If something happens, it can be reported here and
            support is matched straight away.
          </p>
        </div>
      </section>
    );
  }

  const waiting = reports.filter(
    (r) => summariseReport((r.report_services ?? []).map((s) => s.match_status ?? "proposed")).waiting,
  ).length;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ink">Your reports</h2>
        <Link href="/dashboard/reports" className="shrink-0 text-sm font-bold text-purple hover:text-purple-700">
          See all →
        </Link>
      </div>

      {waiting > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {waiting === 1 ? "One report is" : `${waiting} reports are`} waiting on a response —
            open {waiting === 1 ? "it" : "them"} to accept or decline the support offered.
          </p>
        </div>
      )}

      <ul className="divide-y divide-line">
        {reports.map((r) => {
          const states = (r.report_services ?? []).map((s) => s.match_status ?? "proposed");
          const match = summariseReport(states);
          return (
            <li key={r.id}>
              <Link href={`/dashboard/reports/${r.id}`} className="flex items-center gap-3 py-3 group">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-050 text-cyan-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {(r.incident_types ?? []).slice(0, 2).join(", ").replace(/_/g, " ") || "Report"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.county || "County not given"} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Pill tone={STATUS_TONE[r.status ?? "submitted"] ?? "slate"}>
                    {(r.status ?? "submitted").replace(/_/g, " ")}
                  </Pill>
                  {states.length > 0 && (
                    <Pill tone={match.tone}>
                      {states.length === 1 ? matchMeta(states[0]).survivorLabel : match.label}
                    </Pill>
                  )}
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function SubmissionsPanel({ uid }: { uid: string }) {
  const supabase = await createClient();
  const [{ data: posts }, { data: blogs }] = await Promise.all([
    supabase.from("posts").select("id, body, status, created_at")
      .eq("author_id", uid).order("created_at", { ascending: false }).limit(8),
    supabase.from("blogs").select("id, title, slug, status, created_at")
      .eq("author_id", uid).order("created_at", { ascending: false }).limit(8),
  ]);

  const submissions = [
    ...(blogs ?? []).map((b) => ({
      kind: "blog" as const, id: b.id as string, title: b.title as string,
      status: b.status as string, created_at: b.created_at as string,
    })),
    ...(posts ?? []).map((p) => ({
      kind: "post" as const, id: p.id as string, title: (p.body as string)?.slice(0, 80),
      status: p.status as string, created_at: p.created_at as string,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ink">Your submissions</h2>
        <Link href="/dashboard/feed" className="shrink-0 text-sm font-bold text-purple hover:text-purple-700">
          Open feed →
        </Link>
      </div>
      {submissions.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple-050 text-purple">
            <PenLine className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Nothing yet. Share your first update or story from the feed.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {submissions.map((s) => (
            <li key={`${s.kind}-${s.id}`} className="flex items-center gap-3 py-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  s.kind === "blog" ? "bg-purple-050 text-purple" : "bg-cyan-050 text-cyan-700"
                }`}
              >
                {s.kind === "blog" ? <BookOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.title || "Untitled"}</p>
                <p className="text-xs text-muted">
                  {s.kind === "blog" ? "Story" : "Post"} · {timeAgo(s.created_at)}
                </p>
              </div>
              <Pill tone={CONTENT_STATUS_META[s.status]?.tone ?? "slate"}>
                {CONTENT_STATUS_META[s.status]?.label ?? s.status}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
