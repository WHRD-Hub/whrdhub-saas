import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { Pill } from "@/components/ui/pill";
import { MentorReview } from "@/components/mentorship/mentor-review";
import { FEMTORSHIP_QUESTIONS } from "@/lib/data";
import { MENTOR_BUCKET, STATUS_LABEL, STATUS_TONE, type MentorDoc, type MentorStatus } from "@/lib/mentor-verification";

export const metadata = { title: "Mentor — WHRD Hub" };

const yn = (v: boolean | null | undefined) => (v === null || v === undefined ? null : v ? "Yes" : "No");

/** One femtor: who they are, what they answered, the documents they sent, and the decision. */
export default async function MentorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const [{ data: profile }, { data: fem }, { data: ver }] = await Promise.all([
    db.from("profiles").select("id, full_name, username, title, bio, email, county_network_id").eq("id", id).maybeSingle(),
    db.from("mentorship_profiles").select("*").eq("user_id", id).maybeSingle(),
    db.from("mentor_verifications").select("*").eq("user_id", id).maybeSingle(),
  ]);
  if (!profile || !fem) notFound();

  const docs = ((ver?.documents as MentorDoc[]) ?? []);
  const status = ((ver?.status as MentorStatus) ?? "not_submitted");
  // Private files are opened through links that last an hour.
  const signed = docs.length ? ((await db.storage.from(MENTOR_BUCKET).createSignedUrls(docs.map((d) => d.path), 3600)).data ?? []) : [];
  const urls = new Map<string, string>((signed as { path: string; signedUrl: string }[]).map((s) => [s.path, s.signedUrl]));
  let reviewer: string | null = null;
  if (ver?.reviewed_by) {
    const { data } = await db.from("profiles").select("full_name, username").eq("id", ver.reviewed_by).maybeSingle();
    reviewer = data?.full_name || data?.username || null;
  }

  const answers: { q: string; a: string | null }[] = [
    { q: FEMTORSHIP_QUESTIONS.can_provide, a: yn(fem.can_provide) },
    { q: FEMTORSHIP_QUESTIONS.support_offered, a: (fem.support_offered as string[])?.length ? (fem.support_offered as string[]).join(", ") : null },
    { q: FEMTORSHIP_QUESTIONS.in_leadership_role, a: yn(fem.in_leadership_role) },
    { q: FEMTORSHIP_QUESTIONS.leadership_detail, a: fem.leadership_detail },
    { q: FEMTORSHIP_QUESTIONS.has_guide, a: yn(fem.has_guide) },
    { q: FEMTORSHIP_QUESTIONS.relationship_nature, a: fem.relationship_nature },
    { q: FEMTORSHIP_QUESTIONS.support_detail, a: fem.support_detail },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-line bg-surface px-4 py-3">
        <Link href="/hub/mentors" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-purple"><ArrowLeft className="h-3 w-3" /> Mentors</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-ink">{profile.full_name || profile.username || "Member"}</h1>
            <p className="text-xs text-muted">{[profile.title, profile.email].filter(Boolean).join(" · ")}</p>
          </div>
          <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
        </div>
        {profile.bio && <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{profile.bio}</p>}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Their answers</h2>
          <dl className="divide-y divide-line">
            {answers.map(({ q, a }) => (
              <div key={q} className="px-4 py-2.5">
                <dt className="text-[11px] font-medium text-muted">{q}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13px] text-ink">{a || <span className="text-muted">No answer</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        <MentorReview
          mentorId={id}
          status={status}
          reviewNotes={ver?.review_notes ?? null}
          reviewedBy={reviewer}
          reviewedAt={ver?.reviewed_at ?? null}
          own={me?.id === id}
          docs={docs.map((d) => ({ ...d, url: urls.get(d.path) ?? null }))}
        />
      </div>
    </div>
  );
}
