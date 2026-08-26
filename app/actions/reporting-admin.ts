"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireReportingAdmin, requireReportingTriage } from "@/lib/reporting-access";

export async function factCheckReport(
  reportId: string,
  data: {
    verification_status: string;
    verification_notes: string;
    incident_types: string[];
    attack_nature: string;
    derogatory_words: string[];
  },
) {
  const adminId = await requireReportingAdmin();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const user = { id: adminId };

  const { error } = await supabase.from("reports").update({
    verification_status: data.verification_status as "pending" | "verified" | "unverified" | "needs_more_info",
    verification_notes: data.verification_notes,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
    incident_types: data.incident_types,
    attack_nature: data.attack_nature as "coordinated" | "bot_assisted" | "organic" | "unknown",
    derogatory_words: data.derogatory_words,
    status: data.verification_status === "verified" ? "under_review" : "submitted",
  }).eq("id", reportId);

  if (error) return { error: error.message };

  await supabase.from("report_audit_log").insert({
    report_id: reportId,
    viewed_by: user.id,
    action: `fact_check:${data.verification_status}`,
    notes: data.verification_notes,
  });

  revalidatePath(`/hub/reporting/reports/${reportId}`);
  revalidatePath("/hub/reporting/reports");
  revalidatePath("/hub/reporting");
  return { success: true };
}

export async function verifyReport(reportId: string, status: string, notes: string) {
  const adminId = await requireReportingAdmin();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const user = { id: adminId };

  const { error } = await supabase.from("reports").update({
    verification_status: status as "pending" | "verified" | "unverified" | "needs_more_info",
    verification_notes: notes,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
    status: status === "verified" ? "under_review" : "submitted",
  }).eq("id", reportId);

  if (error) return { error: error.message };

  // Audit log
  await supabase.from("report_audit_log").insert({
    report_id: reportId, viewed_by: user.id, action: `fact_check:${status}`,
  });

  revalidatePath(`/hub/reporting/reports/${reportId}`);
  revalidatePath("/hub/reporting/reports");
  revalidatePath("/hub/reporting");
  return { success: true };
}

export async function updateReportStatus(reportId: string, status: string) {
  const adminId = await requireReportingTriage();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const user = { id: adminId };

  const { error } = await supabase.from("reports").update({
    status: status as "submitted" | "under_review" | "referred" | "closed" | "flagged",
    assigned_to: user.id,
  }).eq("id", reportId);
  if (error) return { error: error.message };

  await supabase.from("report_audit_log").insert({
    report_id: reportId, viewed_by: user.id, action: `status_update:${status}`,
  });

  revalidatePath(`/hub/reporting/reports/${reportId}`);
  revalidatePath("/hub/reporting/reports");
  return { success: true };
}

export async function assignService(reportId: string, serviceId: string, note?: string) {
  const adminId = await requireReportingAdmin();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const user = { id: adminId };

  const { error } = await supabase.from("report_services").upsert({
    report_id: reportId, service_id: serviceId, assigned_by: user.id, note: note || null,
  }, { onConflict: "report_id,service_id" });

  if (error) return { error: error.message };
  revalidatePath(`/hub/reporting/reports/${reportId}`);
  return { success: true };
}

export async function removeService(reportId: string, serviceId: string) {
  const adminId = await requireReportingAdmin();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const { error } = await supabase.from("report_services")
    .delete().eq("report_id", reportId).eq("service_id", serviceId);
  if (error) return { error: error.message };
  revalidatePath(`/hub/reporting/reports/${reportId}`);
  return { success: true };
}

export async function createService(data: {
  name: string; description: string; category: string; organization?: string;
  contact_phone?: string; contact_email?: string; contact_url?: string; county?: string;
}) {
  const adminId = await requireReportingAdmin();
  if (!adminId) return { error: "You do not have permission to do that." };
  const supabase = await createClient();
  const user = { id: adminId };

  const { error } = await supabase.from("services").insert({
    ...data,
    category: data.category as "legal" | "medical" | "psychosocial" | "shelter" | "digital_security" | "financial" | "referral" | "other",
    created_by: user.id,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/services");
  return { success: true };
}
