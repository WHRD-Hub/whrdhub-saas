"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireReportingAdmin } from "@/lib/reporting-access";
import { fetchRecentContent, metaConfigured } from "@/lib/meta";
import { ingestItems } from "@/lib/listening";

async function requireAdmin() {
  return await requireReportingAdmin();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function pollMeta() {
  if (!(await requireAdmin())) return { error: "Admins only." };
  if (!metaConfigured()) return { error: "Meta is not connected yet. Add the META_* environment variables first." };
  try {
    const items = await fetchRecentContent();
    const { stored } = await ingestItems(items);
    revalidatePath("/hub/reporting/listening");
    return { ok: true, stored, scanned: items.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function addKeyword(word: string, severity: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const w = word.trim();
  if (w.length < 2) return { error: "Keyword is too short." };
  const { error } = await db().from("listening_keywords").insert({ word: w, severity });
  if (error) return { error: error.message.includes("duplicate") ? "That keyword already exists." : error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function toggleKeyword(id: string, active: boolean) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_keywords").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function removeKeyword(id: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_keywords").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function setResultStatus(id: string, status: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_results").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}
