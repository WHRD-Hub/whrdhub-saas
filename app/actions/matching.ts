"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Responding to a referral.
 *
 * The same action serves both sides. Who the caller is decides which half of
 * the state moves; the database function does that reasoning so it cannot
 * diverge between callers.
 */

const PATHS = [
  "/dashboard/reports",
  "/hub/reporting",
  "/hub/reporting/reports",
  "/hub/reporting/matching",
];

export async function respondToReferral(
  referralId: string,
  decision: "accept" | "decline",
  reason?: string,
): Promise<{ ok?: boolean; state?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_to_match", {
    referral: referralId,
    decision,
    reason: reason ?? null,
  });
  if (error) {
    return {
      error: error.message.includes("not yours")
        ? "This referral is not yours to respond to."
        : error.message,
    };
  }

  for (const p of PATHS) revalidatePath(p);
  revalidatePath(`/dashboard/reports`);
  return { ok: true, state: data as string };
}

/** Re-run matching for one report, after the service directory has changed. */
export async function rematchReport(reportId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_report_services", { target: reportId });
  if (error) return { error: error.message };

  for (const p of PATHS) revalidatePath(p);
  return { ok: true, added: (data as number) ?? 0 };
}
