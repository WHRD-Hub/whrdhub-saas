"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ADJECTIVES = [
  "brave","strong","bold","fierce","proud","wise","calm","bright",
  "steady","gentle","swift","clear","free","safe","sure","true",
  "kind","warm","fair","pure","keen","vast","deep","cool",
];
const NOUNS = [
  "voice","heart","shield","light","hope","star","path","flame",
  "river","dawn","seed","rose","oak","bird","reef","tide",
  "peak","leaf","wave","song","wind","field","moon","sun",
];

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${adj}-${noun}-${suffix}`;
}

export interface ReportData {
  // WHAT
  incident_types: string[];
  description: string;
  what_description?: string;
  // TFGBV digital evidence
  tfgbv_platform?: string;
  tfgbv_link?: string;
  tfgbv_content_text?: string;
  tfgbv_screenshot_urls?: string[];  // uploaded screenshot URLs
  derogatory_words?: string[];       // specific slurs / hateful words used
  attack_nature?: "coordinated" | "bot_assisted" | "organic" | "unknown";
  // WHO
  perpetrator_type?: string;
  perpetrator_detail?: string;
  reporting_for: "self" | "someone_else" | "community_leader";
  // WHERE & WHEN
  county?: string;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  occurred_at?: string;
  occurred_time?: string;
  is_ongoing: boolean;
  // HOW
  how_description?: string;
  evidence_types?: string[];
  // WHY
  activism_context?: string;
  why_description?: string;
  // SUPPORT
  support_needed: string[];
  urgency: "immediate" | "within_week" | "no_rush";
  consent_to_followup: boolean;
  contact_method?: string;
  contact_value?: string;
  // ACCOUNT
  password?: string;
  is_authenticated?: boolean;
  reporter_type?: "anonymous" | "authenticated";
}

export interface SubmitReportResult {
  success: boolean;
  error?: string;
  username?: string;
  virtualEmail?: string;
  reportId?: string;
}

export async function submitReport(data: ReportData): Promise<SubmitReportResult> {
  const supabase = await createClient();

  let userId: string;
  let username: string | undefined;
  let virtualEmail: string | undefined;
  // For anonymous submissions the regular client has no session (the user was
  // just created but never signed in), so the admin client is kept in scope
  // and used for all DB writes in that path.
  let anonAdmin: ReturnType<typeof createAdminClient> | null = null;

  if (data.is_authenticated) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in to submit a report." };
    userId = user.id;
  } else {
    username = generateUsername();
    // Use a placeholder local domain until a real domain is configured.
    virtualEmail = `${username}@whrdhub.local`;

    // Use admin client so the anonymous virtual account is created pre-confirmed -
    // no confirmation email is sent to an address that can't receive mail.
    anonAdmin = createAdminClient();
    const { data: signupData, error: signupError } = await anonAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: data.password!,
      email_confirm: true,
      user_metadata: { username, is_anonymous: true, user_type: "reporter" },
    });

    if (signupError || !signupData.user) {
      console.error("Anonymous account creation error:", signupError);
      return { success: false, error: signupError?.message ?? "Could not create your secure account. Please try again." };
    }
    userId = signupData.user.id;

    // Ensure profile row exists. The trigger fires asynchronously so we upsert
    // via the admin client (service role bypasses RLS; regular client has no
    // session at this point because the anonymous user was just created).
    await anonAdmin.from("profiles").upsert({
      id: userId,
      username,
      is_anonymous: true,
      user_type: "reporter",
      email: virtualEmail,
      onboarding_completed: false,
    }, { onConflict: "id", ignoreDuplicates: false });
  }

  // Use the admin client for anonymous inserts - the regular client has no
  // session cookie for the newly-created user, so auth.uid() would be null
  // and RLS would block the INSERT.
  const insertClient = anonAdmin ?? supabase;

  const combinedDescription = [
    data.what_description && `WHAT: ${data.what_description}`,
    data.how_description  && `HOW: ${data.how_description}`,
    data.why_description  && `WHY: ${data.why_description}`,
  ].filter(Boolean).join("\n\n");

  const { data: reportRow, error: reportError } = await insertClient
    .from("reports")
    .insert([{
      user_id: userId,
      incident_types: data.incident_types,
      description: combinedDescription || data.description,
      // TFGBV
      tfgbv_platform:       data.tfgbv_platform       || null,
      tfgbv_link:           data.tfgbv_link           || null,
      tfgbv_screenshot_urls: data.tfgbv_screenshot_urls?.length ? data.tfgbv_screenshot_urls : null,
      tfgbv_content_text:   data.tfgbv_content_text   || null,
      derogatory_words:   data.derogatory_words?.length ? data.derogatory_words : null,
      attack_nature:      data.attack_nature      || null,
      // WHO
      perpetrator_type:   data.perpetrator_type   || null,
      perpetrator_detail: data.perpetrator_detail || null,
      reporting_for:      data.reporting_for,
      // WHERE & WHEN
      county:               data.county               || null,
      location_description: data.location_description || null,
      latitude:             data.latitude             ?? null,
      longitude:            data.longitude            ?? null,
      occurred_at:          data.occurred_at          || null,
      occurred_time:        data.occurred_time        || null,
      is_ongoing:           data.is_ongoing,
      // HOW
      how_description: data.how_description || null,
      evidence_types:  data.evidence_types  || [],
      // WHY
      activism_context: data.activism_context || null,
      // SUPPORT
      support_needed:      data.support_needed,
      urgency:             data.urgency,
      consent_to_followup: data.consent_to_followup,
      contact_method:      data.contact_method || null,
      contact_value:       data.contact_value  || null,
      // META
      status:              "submitted",
      verification_status: "pending",
      reporter_type:       data.reporter_type || "anonymous",
      channel:             "web",
    }])
    .select("id")
    .single();

  if (reportError) {
    console.error("Report insert error:", reportError);
    return {
      success: false,
      username,
      virtualEmail,
      error: "Account created but report could not be saved. Please log in and try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  revalidatePath("/hub/reporting");

  return {
    success: true,
    username,
    virtualEmail,
    reportId: reportRow?.id,
  };
}
