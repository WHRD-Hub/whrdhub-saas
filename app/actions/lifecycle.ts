"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Deleting things.
 *
 * Two different operations, deliberately not the same word in the UI:
 *
 *  - **Delete** (anyone, on their own content) is a soft delete. The item
 *    leaves the feed immediately, stays in the author's own view marked
 *    "Deleted", and stays fully readable by Hub admins.
 *  - **Delete permanently** (Hub admins only) removes the row.
 *
 * RLS enforces both independently of this file; these actions exist so the UI
 * gets useful errors and the right pages revalidate.
 */

export type ContentKind = "post" | "blog" | "comment";

const TABLE: Record<ContentKind, string> = {
  post: "posts",
  blog: "blogs",
  comment: "post_comments",
};

const CONTENT_PATHS = [
  "/",
  "/feed",
  "/blog",
  "/dashboard",
  "/dashboard/feed",
  "/profile",
  "/hub",
  "/hub/posts",
  "/hub/blogs",
  "/hub/deleted",
];

function refreshContent() {
  for (const p of CONTENT_PATHS) revalidatePath(p);
}

async function logAudit(
  content_type: string,
  content_id: string,
  action: string,
  detail?: string,
) {
  // Service role: the audit log is admin-readable and members must still be
  // able to leave a trail when they delete their own work.
  const admin = createAdminClient();
  const user = await getCurrentUser();
  await admin.from("content_audit_log").insert({
    content_type,
    content_id,
    action,
    actor_id: user?.id ?? null,
    detail: detail ?? null,
  });
}

/** Soft-delete something you wrote. */
export async function deleteOwnContent(kind: ContentKind, id: string, reason?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const table = TABLE[kind];

  const { data: row } = await supabase
    .from(table)
    .select("author_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "That item no longer exists." };
  if (row.author_id !== user.id) return { error: "You can only delete your own content." };
  if (row.deleted_at) return { ok: true };

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_reason: reason || null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "deleted_by_author", reason);
  refreshContent();
  return { ok: true };
}

/** Undo your own delete, while the Hub still has it. */
export async function restoreOwnContent(kind: ContentKind, id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const table = TABLE[kind];

  const { data: row } = await supabase
    .from(table)
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "That item no longer exists." };
  if (row.author_id !== user.id) return { error: "You can only restore your own content." };

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null, deleted_reason: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "restored_by_author");
  refreshContent();
  return { ok: true };
}

// ── Hub admin ──────────────────────────────────────────────────────────────

async function requireHub() {
  const user = await getCurrentUser();
  return user?.profile?.is_hub_admin ? user : null;
}

/** Hub takes something down. The author sees it as removed by the Hub. */
export async function adminSoftDelete(kind: ContentKind, id: string, reason?: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[kind])
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason || "Removed by the Hub",
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "deleted_by_hub", reason);
  refreshContent();
  return { ok: true };
}

export async function adminRestore(kind: ContentKind, id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ deleted_at: null, deleted_reason: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "restored_by_hub");
  refreshContent();
  return { ok: true };
}

/**
 * Permanent removal. There is no undo, so the caller must pass the item's id
 * back as confirmation from a dialog that says so.
 */
export async function adminPurge(kind: ContentKind, id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "purged");
  refreshContent();
  return { ok: true };
}

// ── Reports ────────────────────────────────────────────────────────────────

const REPORT_PATHS = [
  "/hub/reporting",
  "/hub/reporting/reports",
  "/hub/reporting/deleted",
  "/dashboard/reports",
];

/**
 * Reports are only ever deleted by a Hub administrator, never by the reporter:
 * a case the response team is working on is not the reporter's to withdraw
 * unilaterally, and the audit trail matters.
 */
export async function adminDeleteReport(id: string, reason?: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can delete a report." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ deleted_at: new Date().toISOString(), deleted_reason: reason || null })
    .eq("id", id);
  if (error) return { error: error.message };

  const admin = createAdminClient();
  await admin.from("report_audit_log").insert({
    report_id: id,
    viewed_by: hub.id,
    action: "deleted",
    notes: reason ?? null,
  });
  for (const p of REPORT_PATHS) revalidatePath(p);
  return { ok: true };
}

export async function adminRestoreReport(id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can restore a report." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ deleted_at: null, deleted_reason: null })
    .eq("id", id);
  if (error) return { error: error.message };

  const admin = createAdminClient();
  await admin.from("report_audit_log").insert({
    report_id: id,
    viewed_by: hub.id,
    action: "restored",
  });
  for (const p of REPORT_PATHS) revalidatePath(p);
  return { ok: true };
}

export async function adminPurgeReport(id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can delete a report." };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return { error: error.message };
  for (const p of REPORT_PATHS) revalidatePath(p);
  return { ok: true };
}
