import { Heart, Sparkles, HandHeart, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { MatchActions, RunMatching } from "@/components/mentorship/match-actions";
import { FemtorshipForm } from "@/components/femtorship/femtorship-form";
import { MentorDocsBanner } from "@/components/mentorship/mentor-docs-banner";
import { missingDocs, type MentorDoc } from "@/lib/mentor-verification";

export const metadata = { title: "Femtorship — WHRD Hub" };

export default async function MentorshipPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const uid = user!.id;

  const [{ data: fem }, { data: matches }, { data: ver }] = await Promise.all([
    supabase.from("mentorship_profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("mentorship_matches").select("id, mentor_id, mentee_id, overlap, score, status").or(`mentor_id.eq.${uid},mentee_id.eq.${uid}`).order("score", { ascending: false }),
    supabase.from("mentor_verifications").select("status, documents").eq("user_id", uid).maybeSingle(),
  ]);
  // A femtor who is not yet verified is reminded, on every visit, to add the ID and accreditation.
  const missing = (fem as { is_mentor?: boolean } | null)?.is_mentor && ver?.status !== "verified" ? missingDocs((ver?.documents as MentorDoc[]) ?? []) : [];

  const list = matches ?? [];
  const connected = list.filter((m) => m.status === "accepted");
  const asMentor = list.filter((m) => m.mentor_id === uid && m.status === "suggested");
  const asMentee = list.filter((m) => m.mentee_id === uid && m.status === "suggested");

  const MatchCard = ({ m, role }: { m: (typeof list)[number]; role: "mentor" | "mentee" }) => (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{role === "mentor" ? "A defender you could femtor" : "A femtor who could support you"}</p>
          <p className="text-xs text-muted mt-0.5">Identities stay private until you both accept.</p>
        </div>
        <Pill tone={m.status === "accepted" ? "green" : m.status === "declined" ? "slate" : "purple"}>
          {m.status === "accepted" ? "Connected" : m.status === "declined" ? "Passed" : "Suggested"}
        </Pill>
      </div>
      {(m.overlap as string[])?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(m.overlap as string[]).map((o) => <span key={o} className="rounded-full bg-purple-050 text-purple-700 text-xs font-medium px-2.5 py-0.5">{o}</span>)}
        </div>
      )}
      {m.status === "suggested" && <div className="mt-4"><MatchActions matchId={m.id} /></div>}
    </div>
  );

  return (
    <>
      <MentorDocsBanner missing={missing} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2"><Heart className="w-6 h-6 text-magenta-700" /> Femtorship</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">Everything about your femtorship: your answers, your connections, and your suggested matches. You can be a femtor and a femtee at the same time.</p>
        </div>
        {user?.profile?.is_hub_admin && <RunMatching />}
      </div>

      {/* Connected */}
      {connected.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" /> Your connections ({connected.length})</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {connected.map((m) => <MatchCard key={m.id} m={m} role={m.mentor_id === uid ? "mentor" : "mentee"} />)}
          </div>
        </section>
      )}

      {/* Suggested matches */}
      {list.length > connected.length && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-magenta-700 mb-3 flex items-center gap-1.5"><HandHeart className="w-4 h-4" /> Where you could give ({asMentor.length})</h2>
            <div className="space-y-3">{asMentor.length ? asMentor.map((m) => <MatchCard key={m.id} m={m} role="mentor" />) : <p className="text-sm text-muted">No femtee suggestions yet.</p>}</div>
          </section>
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 mb-3 flex items-center gap-1.5"><Heart className="w-4 h-4" /> Where you could grow ({asMentee.length})</h2>
            <div className="space-y-3">{asMentee.length ? asMentee.map((m) => <MatchCard key={m.id} m={m} role="mentee" />) : <p className="text-sm text-muted">No femtor suggestions yet.</p>}</div>
          </section>
        </div>
      )}

      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center mb-8">
          <Sparkles className="w-7 h-7 text-purple mx-auto" />
          <p className="mt-2 font-semibold text-ink">No matches yet</p>
          <p className="text-sm text-muted">Complete your answers below. As more defenders join, the Hub runs matching and your suggestions appear here.</p>
        </div>
      )}

      {/* Femtorship answers form (always available) */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-black text-ink mb-1">Your femtorship answers</h2>
        <p className="text-sm text-muted mb-4">{fem ? "Update your responses any time." : "You haven't answered yet. Fill this in to be matched."}</p>
        <FemtorshipForm fem={fem ?? null} />
      </section>
    </>
  );
}
