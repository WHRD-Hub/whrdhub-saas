"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { computePairings, type MentorshipRow } from "@/lib/mentorship";
import { revalidatePath } from "next/cache";

/**
 * Recompute femtorship pairings across every onboarded defender.
 *
 * Femtorship matching does not wait on anyone's approval. It runs whenever a
 * member saves their answers, so a new femtee is paired within seconds rather
 * than whenever an administrator next remembers to press a button. The Hub can
 * still run it by hand — after a batch of new members, say — and watches the
 * result at /hub/femtorship, but it is an observer here, not a gatekeeper.
 *
 * The service-role client is used because no single member can, or should, read
 * everyone else's questionnaire under RLS.
 *
 * `trigger` distinguishes the automatic run from a deliberate one; the
 * automatic path is silent about permissions because it has none to check.
 */
export async function recomputeAllMatches(
  trigger: "manual" | "auto" = "manual",
): Promise<{ ok?: boolean; error?: string; count?: number }> {
  if (trigger === "manual") {
    const user = await getCurrentUser();
    if (!user) return { error: "Please sign in." };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("mentorship_profiles")
    .select("user_id, is_mentor, is_mentee, guidance_areas, support_offered");
  if (error) return { error: error.message };

  // county_network_id lives on profiles; pull it to give same-county a boost.
  const { data: profs } = await admin
    .from("profiles")
    .select("id, county_network_id");
  const countyOf = new Map((profs ?? []).map((p) => [p.id as string, (p.county_network_id as string) ?? null]));

  const mrows: MentorshipRow[] = (rows ?? []).map((r) => ({
    user_id: r.user_id as string,
    is_mentor: !!r.is_mentor,
    is_mentee: !!r.is_mentee,
    guidance_areas: (r.guidance_areas as string[]) ?? [],
    support_offered: (r.support_offered as string[]) ?? [],
    county_network_id: countyOf.get(r.user_id as string) ?? null,
  }));

  const pairings = computePairings(mrows, 3);

  // Refresh suggestions: clear old 'suggested' rows, keep accepted/declined.
  await admin.from("mentorship_matches").delete().eq("status", "suggested");

  if (pairings.length) {
    const { error: upErr } = await admin.from("mentorship_matches").upsert(
      pairings.map((p) => ({
        mentor_id: p.mentor_id,
        mentee_id: p.mentee_id,
        score: p.score,
        overlap: p.overlap,
        status: "suggested",
      })),
      { onConflict: "mentor_id,mentee_id", ignoreDuplicates: true },
    );
    if (upErr) return { error: upErr.message };
  }

  revalidatePath("/hub");
  revalidatePath("/hub/femtorship");
  revalidatePath("/mentorship");
  revalidatePath("/dashboard");
  return { ok: true, count: pairings.length };
}

/** A participant accepts or declines one of their own suggested matches. */
export async function respondToMatch(matchId: string, decision: "accepted" | "declined") {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("mentorship_matches")
    .select("id, mentor_id, mentee_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Match not found." };
  if (match.mentor_id !== user.id && match.mentee_id !== user.id) {
    return { error: "This match is not yours." };
  }

  // Admin update: the base write policy on matches is Hub-only by design.
  const admin = createAdminClient();
  const { error } = await admin
    .from("mentorship_matches")
    .update({ status: decision })
    .eq("id", matchId);
  if (error) return { error: error.message };

  revalidatePath("/mentorship");
  revalidatePath("/dashboard");
  return { ok: true };
}
