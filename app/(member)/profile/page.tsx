import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/profile-client";
import { listSessions } from "@/app/actions/sessions";
import { loadCountyNetworks } from "@/lib/county-networks";
import { Devices } from "@/components/account/devices";
import { ClaimAccount } from "@/components/account/claim-account";
import { DeleteAccount } from "@/components/account/delete-account";
import { Pill } from "@/components/ui/pill";
import { MentorDocuments } from "@/components/mentorship/mentor-documents";
import type { MentorDoc, MentorStatus } from "@/lib/mentor-verification";

export const metadata = { title: "Profile & account — WHRD Hub" };

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" } as const;

/** One page for the profile and the account behind it. The old /dashboard/account redirects here. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const uid = user!.id;

  const [{ data: ver }, { data: fem }, { data: posts }, { data: blogs }, { data: reactions }, { data: memberships }, counties] =
    await Promise.all([
      supabase.from("mentor_verifications").select("status, documents, review_notes").eq("user_id", uid).maybeSingle(),
      supabase.from("mentorship_profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("posts").select("id, body, status, created_at").eq("author_id", uid).order("created_at", { ascending: false }),
      supabase.from("blogs").select("id, title, slug, status, created_at").eq("author_id", uid).order("created_at", { ascending: false }),
      supabase.from("post_reactions").select("post_id, posts(id, body, is_hub, status)").eq("user_id", uid).limit(50),
      supabase.from("org_memberships").select("id, status, role, decision_notes, organizations(name)").eq("user_id", uid),
      loadCountyNetworks(),
    ]);

  const reactedPosts = (reactions ?? [])
    .map((r) => (Array.isArray(r.posts) ? r.posts[0] : r.posts))
    .filter(Boolean) as { id: string; body: string; is_hub: boolean; status: string }[];

  const networks = (memberships ?? []).length === 0 ? (
    <div>
      <p className="text-sm text-muted">
        You are not part of a county network yet. Joining one lets you post to the feed and publish stories. Your reports stay private either way.
      </p>
      <Link href="/dashboard/network/join" className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600">
        Join a network <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  ) : (
    <ul className="divide-y divide-line">
      {(memberships ?? []).map((m) => {
        const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
        const status = (m.status as keyof typeof STATUS_TONE) ?? "approved";
        return (
          <li key={m.id as string} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{(org as { name?: string } | null)?.name ?? "Organisation"}</p>
              {m.decision_notes ? <p className="mt-0.5 text-xs text-muted">{m.decision_notes as string}</p> : null}
            </div>
            {m.role === "org_admin" && <Pill tone="purple">Network admin</Pill>}
            <Pill tone={STATUS_TONE[status] ?? "slate"}>{status === "pending" ? "Awaiting approval" : status}</Pill>
          </li>
        );
      })}
    </ul>
  );

  return (
    <ProfileClient
      profile={{
        full_name: user?.profile?.full_name ?? "",
        title: user?.profile?.title ?? "",
        bio: user?.profile?.bio ?? "",
        email: user?.email ?? "",
        county_network_id: user?.profile?.county_network_id ?? "",
        username: user?.profile?.username ?? undefined,
      }}
      femtorship={fem ?? null}
      counties={counties}
      posts={posts ?? []}
      blogs={blogs ?? []}
      reactedPosts={reactedPosts}
      isAdmin={!!user?.profile?.is_hub_admin}
      reporterOnly={!!user?.isReporterOnly}
      isMentor={!!(fem as { is_mentor?: boolean } | null)?.is_mentor}
      verification={<MentorDocuments docs={((ver?.documents as MentorDoc[]) ?? [])} status={(ver?.status as MentorStatus) ?? "not_submitted"} reviewNotes={ver?.review_notes as string | null} />}
      initialSection={section}
      claim={user?.needsClaiming ? <ClaimAccount username={user.profile?.username} /> : null}
      networks={networks}
      // Streamed on its own: it reads auth.sessions through an RPC and should not hold up the rest of the page.
      devices={
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-purple-050/70" />}>
          <DeviceList />
        </Suspense>
      }
      deleteAccount={<DeleteAccount email={user?.email} />}
    />
  );
}

async function DeviceList() {
  const sessions = await listSessions();
  return <Devices sessions={sessions} />;
}
