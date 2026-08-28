"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed-in devices.
 *
 * The database does the work — see supabase/install.sql, section 4d — because
 * Supabase does not expose sessions through its client library and because the
 * filtering has to happen somewhere an argument cannot reach. These are a thin
 * pass-through: no session id is ever taken on trust here, it is checked
 * against auth.uid() inside the function.
 */

export interface DeviceSession {
  id: string;
  created_at: string;
  refreshed_at: string;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
}

export async function listSessions(): Promise<DeviceSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_sessions");
  if (error) {
    console.error("[sessions] could not list", error.message);
    return [];
  }
  return (data ?? []) as DeviceSession[];
}

export async function revokeSession(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_session", { target: id });
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function revokeOtherSessions(): Promise<{ ok?: boolean; error?: string; count?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_other_sessions");
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: true, count: (data as number) ?? 0 };
}
