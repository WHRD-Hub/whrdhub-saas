import Link from "next/link";
import { Heart, HandHeart, Users, GitBranch, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { RunMatching } from "@/components/mentorship/match-actions";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Femtorship — WHRD Hub" };

interface Person {
  name: string;
  title: string | null;
  avatar_url: string | null;
  county: string | null;
}

function StatCard({
  label, value, sub, icon: Icon, bg, ic,
}: {
  label: string; value: number; sub?: string;
  icon: typeof Heart; bg: string; ic: string;
}) {
  return (
    <div className={`rounded-2xl ${bg} p-5`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl bg-surface ${ic}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-3xl font-black leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-ink/55">
        {label}
        {sub ? <span className="text-ink/45"> · {sub}</span> : null}
      </p>
    </div>
  );
}

/**
 * The Hub's view of femtorship.
 *
 * Matching is a Hub responsibility — the RLS on mentorship_matches has always
 * said so — but until now there was no screen for it, so the only way to pair
 * anyone was for a member to happen to open their own page. This is where the
 * Hub sees the pools, runs the matcher, and watches what people do with the
 * suggestions.
 *
 * Names are shown here and nowhere else: members see a suggestion without an
 * identity until both sides accept.
 */
export default async function HubFemtorshipPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: matches }, { data: counties }] = await Promise.all([
    supabase
      .from("mentorship_profiles")
      .select("user_id, is_mentor, is_mentee, guidance_areas, support_offered, updated_at"),
    supabase
      .from("mentorship_matches")
      .select("id, mentor_id, mentee_id, score, overlap, status, created_at")
      .order("score", { ascending: false })
      .limit(60),
    supabase.from("county_networks").select("id, name"),
  ]);

  const pool = profiles ?? [];
  const list = matches ?? [];
  const countyName = new Map((counties ?? []).map((c) => [c.id as string, c.name as string]));

  const ids = Array.from(
    new Set([
      ...pool.map((p) => p.user_id as string),
      ...list.flatMap((m) => [m.mentor_id as string, m.mentee_id as string]),
    ]),
  );

  const people = new Map<string, Person>();
  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, title, avatar_url, county_network_id")
      .in("id", ids);
    for (const p of data ?? []) {
      people.set(p.id as string, {
        name: (p.full_name as string) || (p.username as string) || "WHRD member",
        title: (p.title as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        county: countyName.get(p.county_network_id as string) ?? null,
      });
    }
  }

  const mentors = pool.filter((p) => p.is_mentor);
  const mentees = pool.filter((p) => p.is_mentee);
  const both = pool.filter((p) => p.is_mentor && p.is_mentee);
  const connected = list.filter((m) => m.status === "accepted");
  const suggested = list.filter((m) => m.status === "suggested");

  // Someone who asked for a femtor and has no suggestion yet is the thing the
  // Hub most needs to see: a person waiting with nothing offered.
  const menteeIdsWithSuggestion = new Set(
    list.filter((m) => m.status !== "declined").map((m) => m.mentee_id as string),
  );
  const waiting = mentees.filter((p) => !menteeIdsWithSuggestion.has(p.user_id as string));

  const Row = ({
    m,
  }: {
    m: { id: string; mentor_id: string; mentee_id: string; score: number; overlap: string[]; status: string; created_at: string };
  }) => {
    const mentor = people.get(m.mentor_id);
    const mentee = people.get(m.mentee_id);
    return (
      <li className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={mentor?.name ?? "?"} src={mentor?.avatar_url} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{mentor?.name ?? "Unknown"}</p>
            <p className="text-xs text-muted">Femtor{mentor?.county ? ` · ${mentor.county}` : ""}</p>
          </div>
        </div>
        <GitBranch className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={mentee?.name ?? "?"} src={mentee?.avatar_url} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{mentee?.name ?? "Unknown"}</p>
            <p className="text-xs text-muted">Femtee{mentee?.county ? ` · ${mentee.county}` : ""}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {(m.overlap ?? []).slice(0, 2).map((o) => (
            <span
              key={o}
              className="rounded-full bg-purple-050 px-2.5 py-0.5 text-xs font-medium text-purple-700"
            >
              {o}
            </span>
          ))}
          {(m.overlap ?? []).length > 2 && (
            <span className="text-xs text-muted">+{(m.overlap ?? []).length - 2}</span>
          )}
        </div>
        <Pill
          tone={m.status === "accepted" ? "green" : m.status === "declined" ? "slate" : "purple"}
        >
          {m.status === "accepted" ? "Connected" : m.status === "declined" ? "Passed" : "Suggested"}
        </Pill>
        <span className="w-16 shrink-0 text-right text-xs text-muted">{timeAgo(m.created_at)}</span>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
            <Heart className="h-6 w-6 text-magenta-700" /> Femtorship
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Who is offering to femtor, who is asking for one, and how the pairings are
            going. Running the matcher recomputes suggestions for everyone; it never
            disturbs a connection two people have already accepted.
          </p>
        </div>
        <RunMatching />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Offering to femtor" value={mentors.length}
          sub={`${both.length} both ways`} icon={HandHeart} bg="bg-magenta-050" ic="text-magenta-700"
        />
        <StatCard label="Looking for a femtor" value={mentees.length} icon={Users} bg="bg-purple-050" ic="text-purple" />
        <StatCard label="Connected" value={connected.length} icon={Heart} bg="bg-emerald-50" ic="text-emerald-700" />
        <StatCard label="Suggested, undecided" value={suggested.length} icon={Sparkles} bg="bg-cyan-050" ic="text-cyan-700" />
      </div>

      {waiting.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-black text-ink">
            {waiting.length} {waiting.length === 1 ? "person is" : "people are"} waiting with no
            suggestion
          </h2>
          <p className="mt-1 max-w-prose text-sm text-amber-900">
            They asked for a femtor and the matcher has not found one. Usually that means
            nobody has offered support in the areas they need. Run the matcher after new
            members join, or reach out to them directly.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {waiting.slice(0, 12).map((p) => {
              const person = people.get(p.user_id as string);
              return (
                <li key={p.user_id as string}>
                  <Link
                    href={`/hub/members/${p.user_id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-surface py-1 pl-1 pr-3 text-xs font-semibold text-ink hover:bg-amber-100"
                  >
                    <Avatar name={person?.name ?? "?"} src={person?.avatar_url} size={22} />
                    {person?.name ?? "Member"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-ink">Pairings</h2>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
            <Heart className="mx-auto h-8 w-8 text-magenta-700" />
            <p className="mt-3 font-semibold text-ink">No pairings yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Once members have filled in their femtorship answers, run the matcher and
              suggestions appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((m) => (
              <Row
                key={m.id as string}
                m={m as unknown as Parameters<typeof Row>[0]["m"]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
