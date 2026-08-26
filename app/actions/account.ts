"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Account lifecycle.
 *
 * The report form creates a credentialed but anonymous account: a generated
 * username, a password the reporter chose, and a placeholder address at
 * whrdhub.local that can never receive mail. That is the right default — it
 * costs nothing to create and reveals nothing.
 *
 * `claimAccount` is how someone upgrades that into a real, recoverable account
 * without losing the reports already attached to it. It is the same auth user
 * throughout, so nothing has to be migrated.
 */

const PLACEHOLDER_DOMAIN = "@whrdhub.local";

export interface ClaimInput {
  email: string;
  password?: string;
  full_name?: string;
}

export async function claimAccount(input: ClaimInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in first." };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "That does not look like an email address." };
  }
  if (email.endsWith(PLACEHOLDER_DOMAIN)) {
    return { error: "Please use an address you can actually receive mail at." };
  }
  if (input.password !== undefined && input.password.length > 0 && input.password.length < 8) {
    return { error: "Choose a password of at least 8 characters." };
  }

  const admin = createAdminClient();

  // Refuse early with a clear message rather than surfacing a raw auth error.
  const { data: clash } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", user.id)
    .maybeSingle();
  if (clash) {
    return { error: "An account already uses that address. Sign in to it instead." };
  }

  const attrs: { email: string; email_confirm: boolean; password?: string } = {
    email,
    // The reporter is already signed in and proved control of the account by
    // being in it; a confirmation round-trip would only risk locking them out.
    email_confirm: true,
  };
  if (input.password) attrs.password = input.password;

  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, attrs);
  if (authErr) return { error: authErr.message };

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      email,
      is_anonymous: false,
      claimed_at: new Date().toISOString(),
      ...(input.full_name?.trim() ? { full_name: input.full_name.trim() } : {}),
    })
    .eq("id", user.id);
  if (profileErr) return { error: profileErr.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

/**
 * Delete your account.
 *
 * The database function does the work in one transaction: the profile is
 * marked deleted, everything the person wrote is soft-deleted so it leaves the
 * public surfaces, and their memberships are closed. The auth user and all the
 * content are deliberately kept so the Hub can still answer questions about
 * them; reports are left alone, because an open case belongs to the response.
 */
export async function deleteMyAccount(reason?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_account", {
    target: user.id,
    reason: reason || null,
  });
  if (error) return { error: error.message };

  await supabase.auth.signOut();

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/hub/accounts");
  return { ok: true };
}

// ── Hub admin ──────────────────────────────────────────────────────────────

async function requireHub() {
  const user = await getCurrentUser();
  return user?.profile?.is_hub_admin ? user : null;
}

export async function adminDeleteAccount(userId: string, reason?: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };
  if (hub.id === userId) {
    return { error: "Use the account settings page to delete your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_account", {
    target: userId,
    reason: reason || "Removed by the Hub",
  });
  if (error) return { error: error.message };

  revalidatePath("/hub/accounts");
  revalidatePath("/hub/members");
  return { ok: true };
}

export async function adminRestoreAccount(userId: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_account", { target: userId });
  if (error) return { error: error.message };

  revalidatePath("/hub/accounts");
  revalidatePath("/hub/members");
  return { ok: true };
}

/**
 * Irreversible: removes the auth user, which cascades to everything keyed to
 * it. Only offered from the deleted-accounts view, behind a typed confirmation.
 */
export async function adminPurgeAccount(userId: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };
  if (hub.id === userId) return { error: "You cannot purge your own account." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/hub/accounts");
  return { ok: true };
}
