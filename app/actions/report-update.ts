"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { alertOnReport } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RISKS, SUPPORT_TYPES, countryOf } from "@/lib/reporting-options";

/**
 * A reporter changing their own report afterwards: adding the risks they face,
 * widening the support they want, or correcting a detail such as a phone number.
 *
 * Ownership is checked with the signed-in client (the user_id filter on top of
 * row-level security), then the write goes through the service role so it
 * works for the credentialed-but-anonymous accounts the report form creates.
 * Only the fields named here can change; nothing is taken from the client
 * wholesale.
 */

type Result = { ok: true } | { error: string };

async function ownReport(reportId: string): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { error: "That report was not found." };
  return { userId: user.id };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function audit(reportId: string, userId: string, notes: string) {
  // Best effort: a missing audit row must never lose the reporter's update.
  await createAdminClient().from("report_audit_log").insert({
    report_id: reportId, viewed_by: userId, action: "reporter_updated", notes,
  });
}

export async function updateReportRisks(
  reportId: string,
  input: { risks: string[]; support: string[]; supportOther: string },
): Promise<Result> {
  const own = await ownReport(reportId);
  if (!("userId" in own)) return { error: own.error };

  const risks = [...new Set(input.risks)].filter((r) => RISKS.some((x) => x.value === r));
  const support = [...new Set(input.support)].filter((s) => SUPPORT_TYPES.some((x) => x.value === s));
  const other = clean(input.supportOther, 1000);
  if (support.includes("other") && !other) return { error: "Tell us what other support you need, or untick Other." };

  const { error } = await createAdminClient()
    .from("reports")
    .update({ risks, support_needed: support, support_other: support.includes("other") ? other : null })
    .eq("id", reportId);
  if (error) return { error: "Could not save that just now. Please try again." };

  await audit(reportId, own.userId, "Updated risks and support");
  // Newly listed risks can make a report critical; alertOnReport does nothing if it already was.
  after(() => alertOnReport(reportId));
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/hub/reporting");
  return { ok: true };
}

export interface ReportDetailsInput {
  description: string;
  county: string;
  location_description: string;
  occurred_at: string;
  occurred_time: string;
  perpetrator_detail: string;
  contact_method: string;
  contact_value: string;
}

export async function updateReportDetails(reportId: string, input: ReportDetailsInput): Promise<Result> {
  const own = await ownReport(reportId);
  if (!("userId" in own)) return { error: own.error };

  const description = clean(input.description, 8000);
  if (description.length < 20) return { error: "Please keep a description of at least 20 characters." };

  const method = clean(input.contact_method, 20);
  if (method && !["phone", "whatsapp", "email", "sms"].includes(method)) return { error: "Choose a valid contact method." };
  const date = clean(input.occurred_at, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "That date does not look right." };
  const time = clean(input.occurred_time, 5);
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: "That time does not look right." };
  const county = clean(input.county, 80);

  const changes: Record<string, unknown> = {
    description,
    county: county || null,
    country: countryOf(county),
    location_description: clean(input.location_description, 500) || null,
    occurred_at: date || null,
    occurred_time: time || null,
    perpetrator_detail: clean(input.perpetrator_detail, 500) || null,
    contact_method: method || null,
    contact_value: clean(input.contact_value, 200) || null,
    // Giving a way to be reached is consent to be reached.
    consent_to_followup: !!(method && clean(input.contact_value, 200)),
  };

  const { error } = await createAdminClient().from("reports").update(changes).eq("id", reportId);
  if (error) return { error: "Could not save that just now. Please try again." };

  await audit(reportId, own.userId, "Corrected report details");
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/hub/reporting");
  return { ok: true };
}

/** Attach evidence files an anonymous reporter uploaded just after their account was created. */
export async function attachScreenshots(reportId: string, paths: string[]): Promise<Result> {
  const own = await ownReport(reportId);
  if (!("userId" in own)) return { error: own.error };
  const mine = paths.filter((p) => typeof p === "string" && p.startsWith(`${own.userId}/`)).slice(0, 10);
  if (mine.length === 0) return { error: "No files to attach." };

  const admin = createAdminClient();
  const { data: row } = await admin.from("reports").select("tfgbv_screenshot_urls").eq("id", reportId).maybeSingle();
  const existing = ((row?.tfgbv_screenshot_urls as string[] | null) ?? []).filter(Boolean);
  const { error } = await admin.from("reports").update({ tfgbv_screenshot_urls: [...new Set([...existing, ...mine])] }).eq("id", reportId);
  if (error) return { error: "Could not attach the files just now." };
  await audit(reportId, own.userId, "Attached evidence files");
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath("/hub/reporting");
  return { ok: true };
}

/** Attach voice notes recorded by the reporter, after the report exists. Only their own folder is accepted. */
export async function attachVoiceNote(reportId: string, paths: string[]): Promise<Result> {
  const own = await ownReport(reportId);
  if (!("userId" in own)) return { error: own.error };
  const mine = paths.filter((p) => typeof p === "string" && p.startsWith(`${own.userId}/voice_`)).slice(0, 3);
  if (mine.length === 0) return { error: "No voice note to attach." };

  const { error } = await createAdminClient().from("reports").update({ voice_note_paths: mine }).eq("id", reportId);
  if (error) return { error: "Could not attach the voice note just now." };
  await audit(reportId, own.userId, "Attached a voice note");
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath("/hub/reporting");
  return { ok: true };
}
