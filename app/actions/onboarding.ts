"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { recomputeAllMatches } from "@/app/actions/mentorship";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "org";
}

export interface OnboardingInput {
  terms_accepted: boolean;
  full_name: string;
  title?: string;
  county_network_id: string;
  // org: either join an existing org or create a new one
  organization_id?: string;
  new_org_name?: string;
  new_org_description?: string;
  // femtorship questionnaire
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
}

export async function completeOnboarding(input: OnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  if (!input.terms_accepted) return { error: "Please accept the terms to continue." };

  // All writes go through the service-role client. The user is already verified
  // above; using admin here guarantees the writes persist regardless of the RLS
  // policies on the shared profiles table (which the reporting app owns).
  const admin = createAdminClient();

  // 1. Profile basics + SaaS terms acceptance. Upsert so it works even if the
  //    profile row was never created by the reporting app's trigger.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: input.full_name,
        title: input.title || null,
        county_network_id: input.county_network_id,
        hub_onboarded: true,
        hub_terms_accepted_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (profileErr) return { error: profileErr.message };

  // 2. Organisation: join existing, or propose a new one. New orgs are keyed by
  //    a slug so re-running onboarding with the same name reuses the existing
  //    org instead of creating a duplicate.
  let organizationId = input.organization_id;
  let isCreator = false;
  if (!organizationId && input.new_org_name?.trim()) {
    const name = input.new_org_name.trim();
    const slug = slugify(name);
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      organizationId = existing.id as string;
    } else {
      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .insert({
          name,
          slug,
          description: input.new_org_description || null,
          county_network_id: input.county_network_id,
          created_by: user.id,
          verification_status: "pending",
        })
        .select("id")
        .single();
      if (orgErr) return { error: orgErr.message };
      organizationId = org.id;
      isCreator = true;
    }
  }

  if (organizationId) {
    // Founding an organisation makes you its admin immediately. Joining an
    // existing one is a request that its admins decide on, so nobody can add
    // themselves to a network they have no connection to.
    const { error: memErr } = await admin.from("org_memberships").upsert(
      {
        organization_id: organizationId,
        user_id: user.id,
        role: isCreator ? "org_admin" : "member",
        status: isCreator ? "approved" : "pending",
        requested_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true },
    );
    if (memErr) return { error: memErr.message };

    if (!isCreator) {
      const { data: orgAdmins } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("role", "org_admin")
        .eq("status", "approved");
      let recipients = (orgAdmins ?? []).map((a) => a.user_id as string);
      if (recipients.length === 0) {
        const { data: hubAdmins } = await admin.from("profiles").select("id").eq("is_hub_admin", true);
        recipients = (hubAdmins ?? []).map((a) => a.id as string);
      }
      if (recipients.length) {
        await admin.from("notifications").insert(
          recipients.map((id) => ({
            user_id: id,
            type: "membership",
            title: "New membership request",
            body: `${input.full_name} asked to join your network.`,
            link: "/dashboard/network",
            content_type: "organization",
          })),
        );
      }
    }
  }

  // 3. Femtorship questionnaire
  const { error: mentErr } = await admin.from("mentorship_profiles").upsert(
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
  if (mentErr) return { error: mentErr.message };

  // Pair them straight away — femtorship matching waits on no approval.
  try {
    await recomputeAllMatches("auto");
  } catch {
    /* best effort; their profile is saved regardless */
  }

  revalidatePath("/dashboard");
  revalidatePath("/hub/femtorship");
  return { ok: true };
}
