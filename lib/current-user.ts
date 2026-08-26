import { createClient } from "@/lib/supabase/server";

export interface HubProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_hub_admin: boolean;
  hub_onboarded: boolean;
  county_network_id: string | null;
  /** Reporting platform fields, now part of the same profile row. */
  is_anonymous: boolean | null;
  user_type: "reporter" | "defender" | "admin" | null;
  preferred_language: string | null;
  account_deleted_at: string | null;
  claimed_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  /**
   * True for the credentialed-but-anonymous accounts the report form creates.
   * These people have no Hub community profile and must never be pushed
   * through Hub member onboarding — their home is /dashboard/reports.
   */
  isReporterOnly: boolean;
  /** The account was deleted. Every authenticated surface must refuse it. */
  isDeleted: boolean;
  /** Banned by the Hub. Can read, cannot act. */
  isBanned: boolean;
  /** Still on a generated username and an unreachable placeholder address. */
  needsClaiming: boolean;
  /**
   * May write to the feed: an approved membership of a county network's
   * organisation, or Hub staff. Reading and supporting need no membership.
   */
  canPost: boolean;
  profile: HubProfile | null;
  membership: {
    organization_id: string;
    role: string;
    organizations: { name: string; verification_status: string } | null;
  } | null;
}

/** Returns the signed-in user with profile + primary org membership, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, username, title, bio, avatar_url, is_hub_admin, hub_onboarded, county_network_id, is_anonymous, user_type, preferred_language, account_deleted_at, claimed_at, banned_at, ban_reason",
    )
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("organization_id, role, status, organizations(name, verification_status)")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  const p = (profile as HubProfile) ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    isReporterOnly:
      !!p && !p.hub_onboarded && !p.is_hub_admin && (p.is_anonymous === true || p.user_type === "reporter"),
    isDeleted: !!p?.account_deleted_at,
    isBanned: !!p?.banned_at,
    needsClaiming: !!p?.is_anonymous && !p.claimed_at,
    canPost:
      !p?.account_deleted_at &&
      !p?.banned_at &&
      (!!p?.is_hub_admin ||
        p?.user_type === "admin" ||
        p?.user_type === "defender" ||
        !!membership),
    profile: p,
    membership: membership
      ? {
          organization_id: membership.organization_id as string,
          role: membership.role as string,
          organizations: Array.isArray(membership.organizations)
            ? (membership.organizations[0] ?? null)
            : (membership.organizations as { name: string; verification_status: string } | null),
        }
      : null,
  };
}
