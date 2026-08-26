import Link from "next/link";
import { Gavel, PauseCircle, Ban, Building2, ArrowUpRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { BanControls } from "@/components/hub/ban-controls";

export const metadata = { title: "Moderation — WHRD Hub" };

interface Person {
  name: string;
  title: string | null;
  avatar_url: string | null;
  banned_at: string | null;
  ban_reason: string | null;
}

/**
 * Where the Hub sees what the networks have done, and decides whether it goes
 * further.
 *
 * A network admin can suspend one of their own members but cannot ban. Every
 * suspension raises a notification here. Banning is the only escalation and it
 * is the Hub's alone.
 */
export default async function ModerationPage() {
  // Service role: a Hub admin is not otherwise entitled to read the profile of
  // someone suspended from a network they have nothing to do with.
  const admin = createAdminClient();

  const [{ data: suspensions }, { data: banned }] = await Promise.all([
    admin
      .from("org_memberships")
      .select(
        "id, user_id, organization_id, suspended_at, suspended_by, suspension_reason, organizations(name)",
      )
      .eq("status", "suspended")
      .order("suspended_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, full_name, username, title, avatar_url, email, banned_at, banned_by, ban_reason")
      .not("banned_at", "is", null)
      .order("banned_at", { ascending: false }),
  ]);

  const rows = suspensions ?? [];
  const bannedList = banned ?? [];

  const ids = Array.from(
    new Set([
      ...rows.map((r) => r.user_id as string),
      ...rows.map((r) => r.suspended_by as string | null),
    ].filter(Boolean)),
  ) as string[];

  const people = new Map<string, Person>();
  if (ids.length) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, username, title, avatar_url, banned_at, ban_reason")
      .in("id", ids);
    for (const p of data ?? []) {
      people.set(p.id as string, {
        name: (p.full_name as string) || (p.username as string) || "Member",
        title: (p.title as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        banned_at: (p.banned_at as string) ?? null,
        ban_reason: (p.ban_reason as string) ?? null,
      });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <Gavel className="h-6 w-6 text-purple" /> Moderation
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Networks can pause one of their own members. They cannot remove anyone from the
          platform &mdash; that decision is the Hub&apos;s, and it is made here.
        </p>
      </div>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-ink">
          <PauseCircle className="h-5 w-5 text-amber-600" /> Suspended by their network
          {rows.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {rows.length}
            </span>
          )}
        </h2>
        <p className="mb-3 max-w-prose text-sm text-muted">
          Each of these was a network admin&apos;s decision. Lifting one is theirs too;
          banning is yours.
        </p>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
            No one is suspended right now.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map((r) => {
              const person = people.get(r.user_id as string);
              const by = r.suspended_by ? people.get(r.suspended_by as string) : null;
              const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
              if (!person) return null;
              return (
                <li key={r.id as string} className="flex flex-wrap items-start gap-3 p-4">
                  <Avatar name={person.name} src={person.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{person.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <Building2 className="h-3 w-3" />
                      <span>{(org as { name?: string } | null)?.name ?? "a network"}</span>
                      <span aria-hidden>·</span>
                      <span>
                        suspended {r.suspended_at ? timeAgo(r.suspended_at as string) : ""}
                        {by ? ` by ${by.name}` : ""}
                      </span>
                    </p>
                    {r.suspension_reason && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                        {r.suspension_reason as string}
                      </p>
                    )}
                    {person.banned_at && (
                      <span className="mt-2 inline-block">
                        <Pill tone="red">Already banned</Pill>
                      </span>
                    )}
                  </div>
                  <BanControls
                    userId={r.user_id as string}
                    name={person.name}
                    banned={!!person.banned_at}
                    reason={person.ban_reason}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-ink">
          <Ban className="h-5 w-5 text-rose-600" /> Banned accounts
          {bannedList.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              {bannedList.length}
            </span>
          )}
        </h2>
        <p className="mb-3 max-w-prose text-sm text-muted">
          These accounts can sign in but cannot post, comment, support, or file a report.
          Nothing they wrote has been deleted.
        </p>

        {bannedList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
            No accounts are banned.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-rose-200 bg-surface">
            {bannedList.map((p) => {
              const name = (p.full_name as string) || (p.username as string) || "Member";
              return (
                <li key={p.id as string} className="flex flex-wrap items-start gap-3 p-4">
                  <Avatar name={name} src={p.avatar_url as string | null} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {(p.email as string) || "no address"} · banned{" "}
                      {timeAgo(p.banned_at as string)}
                    </p>
                    {p.ban_reason && (
                      <p className="mt-2 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">
                        {p.ban_reason as string}
                      </p>
                    )}
                  </div>
                  <BanControls userId={p.id as string} name={name} banned reason={null} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted">
        Looking for accounts people have closed themselves?{" "}
        <Link href="/hub/accounts" className="font-semibold text-purple hover:underline">
          Deleted accounts <ArrowUpRight className="inline h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
