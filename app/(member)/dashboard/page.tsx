import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PenLine, Building2, Heart, FileText, BookOpen, ShieldCheck, ArrowUpRight, AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { CONTENT_STATUS_META, VERIF_STATUS_META } from "@/lib/data";
import { PostComposerModal } from "@/components/composer/post-composer-modal";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Anonymous reporter accounts have no community profile — their dashboard is
  // the reports list.
  if (user?.isReporterOnly) redirect("/dashboard/reports");

  const supabase = await createClient();
  const uid = user!.id;

  const [{ data: posts }, { data: blogs }, { data: matches }, { data: reports }] = await Promise.all([
    supabase.from("posts").select("id, body, status, created_at").eq("author_id", uid).order("created_at", { ascending: false }).limit(8),
    supabase.from("blogs").select("id, title, slug, status, created_at").eq("author_id", uid).order("created_at", { ascending: false }).limit(8),
    supabase.from("mentorship_matches").select("id").or(`mentor_id.eq.${uid},mentee_id.eq.${uid}`),
    supabase.from("reports").select("id, status, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(6),
  ]);

  const reportsList = reports ?? [];
  const actionedReports = reportsList.filter((r) => r.status && r.status !== "submitted").length;
  const org = user?.membership?.organizations;
  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "there";

  const submissions = [
    ...(blogs ?? []).map((b) => ({ kind: "blog" as const, id: b.id, title: b.title as string, status: b.status as string, created_at: b.created_at as string })),
    ...(posts ?? []).map((p) => ({ kind: "post" as const, id: p.id, title: (p.body as string)?.slice(0, 80), status: p.status as string, created_at: p.created_at as string })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {/* Warm greeting */}
      <div className="rounded-2xl p-6 sm:p-7 mb-6 bg-gradient-to-br from-[#fdf1e7] via-magenta-050 to-purple-050 border border-line">
        <h1 className="text-2xl sm:text-3xl font-black text-ink">Karibu, {name} 👋</h1>
        <p className="text-ink/70 mt-1">Welcome back, ready to make a difference?</p>
      </div>

      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted mb-3">Dashboard</p>

      {/* Quick cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Compose — opens in place (drawer on mobile, modal on desktop) */}
        <Suspense fallback={<div className="rounded-2xl bg-emerald-50 h-full min-h-[7rem]" />}>
          <PostComposerModal variant="card" isHub={!!user?.profile?.is_hub_admin} userName={name} avatarUrl={user?.profile?.avatar_url} />
        </Suspense>

        <Link href="/dashboard/reports" className="block">
          <div className="rounded-2xl bg-cyan-050 p-5 h-full hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-white text-cyan-700"><ShieldCheck className="w-5 h-5" /></div>
            <p className="mt-3 font-bold text-ink truncate">{reportsList.length} report{reportsList.length === 1 ? "" : "s"}</p>
            <p className="text-xs text-ink/60">{actionedReports > 0 ? `${actionedReports} with updates` : "Private to you"}</p>
          </div>
        </Link>

        <Link href="/mentorship" className="block">
          <div className="rounded-2xl bg-magenta-050 p-5 h-full hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-white text-magenta-700"><Heart className="w-5 h-5" /></div>
            <p className="mt-3 font-bold text-ink">{matches?.length ?? 0} match{(matches?.length ?? 0) === 1 ? "" : "es"}</p>
            <p className="text-xs text-ink/60">Femtorship</p>
          </div>
        </Link>

        {/* Your CBO — with verification status */}
        <Link href="/profile" className="block">
          <div className="rounded-2xl bg-purple-050 p-5 h-full hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-white text-purple"><Building2 className="w-5 h-5" /></div>
            <p className="mt-3 font-bold text-ink truncate">{org?.name ?? "No organisation"}</p>
            {org ? (
              <div className="mt-1"><Pill tone={VERIF_STATUS_META[org.verification_status]?.tone ?? "slate"}>{VERIF_STATUS_META[org.verification_status]?.label ?? org.verification_status}</Pill></div>
            ) : <p className="text-xs text-ink/60">Join one from your profile</p>}
          </div>
        </Link>
      </div>

      {/* Reports banner */}
      {actionedReports > 0 && (
        <Link href="/dashboard/reports" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6 hover:shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 flex-1"><span className="font-bold">{actionedReports}</span> of your reports {actionedReports === 1 ? "has" : "have"} updates or assigned support.</p>
          <ArrowUpRight className="w-4 h-4 text-amber-700" />
        </Link>
      )}

      {/* Submissions */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-ink">Your submissions</h2>
          <Link href="/dashboard/feed" className="text-sm font-bold text-purple hover:text-purple-700">Open feed →</Link>
        </div>
        {submissions.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-050 text-purple grid place-items-center mx-auto"><PenLine className="w-6 h-6" /></div>
            <p className="mt-3 text-sm text-muted">Nothing yet. Share your first update or story from the feed.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {submissions.map((s) => (
              <div key={`${s.kind}-${s.id}`} className="flex items-center gap-3 py-3">
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${s.kind === "blog" ? "bg-purple-050 text-purple" : "bg-cyan-050 text-cyan-700"}`}>
                  {s.kind === "blog" ? <BookOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate font-medium">{s.title || "Untitled"}</p>
                  <p className="text-xs text-muted">{s.kind === "blog" ? "Story" : "Post"} · {timeAgo(s.created_at)}</p>
                </div>
                <Pill tone={CONTENT_STATUS_META[s.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[s.status]?.label ?? s.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
