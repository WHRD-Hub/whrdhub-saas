"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Moderation.
 *
 * Two levels, and they belong to different people. A network's admins can
 * suspend one of their own members: local, reversible, and it tells the Hub.
 * Only the Hub can ban an account outright. A network admin who wants someone
 * removed from the platform suspends them and lets the Hub decide.
 *
 * The rules themselves live in the database functions these call, so the same
 * boundaries hold whatever reaches them.
 */

export interface ModerationResult {
  ok?: boolean;
  error?: string;
}

const PATHS = ["/dashboard/network", "/hub/members", "/hub/accounts", "/feed", "/dashboard"];

function refresh() {
  for (const p of PATHS) revalidatePath(p);
}

function readable(message: string): string {
  // The database raises these; they are already written for a person to read.
  return message.replace(/^.*?(?:ERROR:\s*)?/, "").trim() || "That did not work.";
}

export async function suspendMember(membershipId: string, reason?: string): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_member", {
    membership: membershipId,
    reason: reason || null,
  });
  if (error) return { error: readable(error.message) };

  refresh();
  return { ok: true };
}

export async function unsuspendMember(membershipId: string): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unsuspend_member", { membership: membershipId });
  if (error) return { error: readable(error.message) };

  refresh();
  return { ok: true };
}

export async function banAccount(userId: string, reason?: string): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user?.profile?.is_hub_admin) return { error: "Only the Hub can ban an account." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ban_account", { target: userId, reason: reason || null });
  if (error) return { error: readable(error.message) };

  refresh();
  return { ok: true };
}

export async function unbanAccount(userId: string): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user?.profile?.is_hub_admin) return { error: "Only the Hub can lift a ban." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unban_account", { target: userId });
  if (error) return { error: readable(error.message) };

  refresh();
  return { ok: true };
}
