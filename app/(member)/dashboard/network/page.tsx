import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MembershipDecisions,
  type MemberRow,
} from "@/components/network/membership-decisions";

export const metadata = { title: "Your network — WHRD Hub" };

interface Row {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
  role: string;
  requested_at: string | null;
  request_note: string | null;
  organizations: { name: string } | { name: string }[] | null;
}

/**
 * Where a network's admins approve the people asking to join.
 *
 * Hub admins land here too, but see every organisation rather than only the
 * ones they administer.
 */
export default async function NetworkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/network");

  const supabase = await createClient();
  const isHubAdmin = !!user.profile?.is_hub_admin;

  const { data: mine } = await supabase
    .from("org_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "org_admin")
    .eq("status", "approved");

  const adminOrgIds = (mine ?? []).map((m) => m.organization_id as string);
  if (!isHubAdmin && adminOrgIds.length === 0) {
    // Not an administrator of anything: the account page is the useful place.
    redirect("/dashboard/account");
  }

  let query = supabase
    .from("org_memberships")
    .select("id, user_id, organization_id, status, role, requested_at, request_note, organizations(name)")
    .order("requested_at", { ascending: false });
  if (!isHubAdmin) query = query.in("organization_id", adminOrgIds);

  const { data: rows } = await query;
  const list = (rows ?? []) as unknown as Row[];

  // Profiles are read with the service role: an org admin is not otherwise
  // entitled to read the profile of someone who has only *requested* to join.
  const admin = createAdminClient();
  const ids = Array.from(new Set(list.map((r) => r.user_id)));
  const people = new Map<
    string,
    { name: string; title: string | null; avatar_url: string | null; fromReporting: boolean }
  >();
  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, username, title, avatar_url, is_anonymous, user_type, claimed_at, account_deleted_at")
      .in("id", ids);
    for (const p of profiles ?? []) {
      if (p.account_deleted_at) continue;
      people.set(p.id as string, {
        name: (p.full_name as string) || (p.username as string) || "WHRD member",
        title: (p.title as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        fromReporting: !!p.claimed_at || p.is_anonymous === true || p.user_type === "reporter",
      });
    }
  }

  const toRow = (r: Row): MemberRow | null => {
    const person = people.get(r.user_id);
    if (!person) return null;
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return {
      id: r.id,
      status: (r.status as MemberRow["status"]) ?? "approved",
      role: (r.role as MemberRow["role"]) ?? "member",
      requested_at: r.requested_at,
      request_note: r.request_note,
      orgName: org?.name ?? "",
      person,
    };
  };

  const mapped = list.map(toRow).filter(Boolean) as MemberRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <Users className="h-6 w-6 text-purple" /> Your network
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isHubAdmin
            ? "Every membership request across the Hub."
            : "People asking to join the organisation you administer."}
        </p>
      </div>

      <MembershipDecisions
        pending={mapped.filter((r) => r.status === "pending")}
        members={mapped.filter((r) => r.status === "approved")}
        canManageRoles={isHubAdmin || adminOrgIds.length > 0}
      />
    </div>
  );
}
