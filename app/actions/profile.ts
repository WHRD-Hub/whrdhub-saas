"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { deleteOwnContent as softDeleteOwnContent } from "@/app/actions/lifecycle";
import { deleteMyAccount } from "@/app/actions/account";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function updateProfile(input: {
  full_name: string;
  title?: string;
  bio?: string;
  county_network_id?: string;
}) {
  const user = await requireUser();
  if (!user) return { error: "Please sign in." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name,
      title: input.title || null,
      bio: input.bio || null,
      ...(input.county_network_id ? { county_network_id: input.county_network_id } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveFemtorship(input: {
  in_leadership_role?: boolean;
  leadership_detail?: string;
  has_guide?: boolean;
  relationship_nature?: string;
  barriers?: string;
  wants_mentor?: boolean;
  desired_qualities?: string[];
  guidance_areas?: string[];
  can_provide?: boolean;
  support_offered?: string[];
  support_detail?: string;
}) {
  const user = await requireUser();
  if (!user) return { error: "Please sign in." };
  const admin = createAdminClient();
  const { error } = await admin.from("mentorship_profiles").upsert(
    {
      user_id: user.id,
      in_leadership_role: input.in_leadership_role ?? null,
      leadership_detail: input.leadership_detail || null,
      has_guide: input.has_guide ?? null,
      relationship_nature: input.relationship_nature || null,
      barriers: input.barriers || null,
      wants_mentor: input.wants_mentor ?? null,
      desired_qualities: input.desired_qualities ?? [],
      guidance_areas: input.guidance_areas ?? [],
      can_provide: input.can_provide ?? null,
      support_offered: input.support_offered ?? [],
      support_detail: input.support_detail || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/mentorship");
  return { ok: true };
}

/**
 * Kept as thin aliases so existing callers keep working.
 *
 * Deleting your own content is a SOFT delete now: it leaves the feed, stays in
 * your own view marked "Deleted", and the Hub retains it. Account deletion no
 * longer destroys the auth user or the content either - the person disappears
 * from every member-facing surface and the Hub keeps the record.
 *
 * The real implementations live in app/actions/lifecycle.ts and
 * app/actions/account.ts.
 */
export async function deleteOwnContent(kind: "post" | "blog", id: string) {
  return softDeleteOwnContent(kind, id);
}

export async function deleteAccount() {
  return deleteMyAccount();
}
