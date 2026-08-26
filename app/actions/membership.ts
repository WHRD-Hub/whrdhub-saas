"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Joining a county network's CBO is a request, not an act.
 *
 * Anyone with an account can ask — including someone whose account began life
 * on the reporting side. The organisation's own admins approve or decline, and
 * Hub admins can do either on any organisation.
 */

export type MembershipStatus = "pending" | "approved" | "rejected";

async function notify(userId: string, title: string, body: string, link: string) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: userId,
    type: "membership",
    title,
    body,
    link,
    content_type: "organization",
  });
}

/** Ask to join an organisation. */
export async function requestMembership(organizationId: string, note?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (user.profile?.account_deleted_at) return { error: "This account has been deleted." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("org_memberships")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "approved") return { error: "You are already a member." };
  if (existing?.status === "pending") return { ok: true, status: "pending" as const };

  // A previously declined request can be made again.
  if (existing) {
    const { error } = await supabase
      .from("org_memberships")
      .update({
        status: "pending",
        request_note: note || null,
        requested_at: new Date().toISOString(),
        decided_at: null,
        decided_by: null,
        decision_notes: null,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("org_memberships").insert({
      organization_id: organizationId,
      user_id: user.id,
      role: "member",
      status: "pending",
      request_note: note || null,
    });
    if (error) return { error: error.message };
  }

  // Tell the organisation's admins, and the Hub if it has none yet.
  const admin = createAdminClient();
  const { data: orgAdmins } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "org_admin")
    .eq("status", "approved");

  let recipients = (orgAdmins ?? []).map((a) => a.user_id as string);
  if (recipients.length === 0) {
    const { data: hubAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("is_hub_admin", true);
    recipients = (hubAdmins ?? []).map((a) => a.id as string);
  }

  const who = user.profile?.full_name || user.profile?.username || "Someone";
  for (const r of recipients) {
    await notify(r, "New membership request", `${who} asked to join your network.`, "/dashboard/network");
  }

  revalidatePath("/organizations");
  revalidatePath("/profile");
  revalidatePath("/dashboard/network");
  return { ok: true, status: "pending" as const };
}

/** Approve or decline a request. Org admins for their own org; Hub for any. */
export async function decideMembership(
  membershipId: string,
  decision: "approved" | "rejected",
  notes?: string,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("org_memberships")
    .select("id, user_id, organization_id, organizations(name)")
    .eq("id", membershipId)
    .maybeSingle();
  if (!row) return { error: "That request no longer exists." };

  // RLS is the real gate; this produces a readable message instead of a
  // silent no-op when someone without permission tries.
  const { error } = await supabase
    .from("org_memberships")
    .update({ status: decision, decision_notes: notes || null })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  const { data: after } = await supabase
    .from("org_memberships")
    .select("status")
    .eq("id", membershipId)
    .maybeSingle();
  if (after?.status !== decision) {
    return { error: "You do not have permission to decide this request." };
  }

  const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const orgName = (org as { name?: string } | null)?.name ?? "the network";
  await notify(
    row.user_id as string,
    decision === "approved" ? `You have joined ${orgName}` : `Your request to join ${orgName} was declined`,
    decision === "approved"
      ? "You can now post to the feed and publish stories as a member."
      : notes || "Get in touch with the network if you think this was a mistake.",
    decision === "approved" ? "/dashboard" : "/organizations",
  );

  revalidatePath("/dashboard/network");
  revalidatePath("/hub/members");
  revalidatePath("/profile");
  return { ok: true };
}

/** Promote or demote someone within an organisation. */
export async function setMemberRole(membershipId: string, role: "member" | "org_admin") {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_memberships")
    .update({ role })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/network");
  revalidatePath("/hub/members");
  return { ok: true };
}
