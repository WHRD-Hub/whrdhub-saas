"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Deleting things.
 *
 * From the person's side there is one action, "Delete", and it means gone: the
 * item leaves the feed and leaves their account. Underneath it is a soft
 * delete, so the Hub keeps the record for safeguarding — that is a back-office
 * fact and is never surfaced to the author, who would reasonably read it as
 * "your delete did not work".
 *
 * The write goes through the delete_own_content() database function rather
 * than a plain UPDATE. PostgreSQL applies SELECT policies to the updated row,
 * so an author-run UPDATE that hid the row from its own author would be
 * rejected; the function runs as definer and does the ownership check itself.
 */

export type ContentKind = "post" | "blog" | "comment" | "report";

/** Every action here returns the same shape so call sites can be uniform. */
export interface ActionResult {
  ok?: boolean;
  error?: string;
}

const CONTENT_PATHS = [
  "/",
  "/feed",
  "/blog",
  "/dashboard",
  "/dashboard/feed",
  "/dashboard/reports",
  "/profile",
  "/hub",
  "/hub/posts",
  "/hub/blogs",
  "/hub/deleted",
  "/hub/reporting",
  "/hub/reporting/reports",
  "/hub/reporting/deleted",
];

function refresh() {
  for (const p of CONTENT_PATHS) revalidatePath(p);
}

async function logAudit(kind: string, id: string, action: string, detail?: string) {
  const admin = createAdminClient();
  const user = await getCurrentUser();
  await admin.from("content_audit_log").insert({
    content_type: kind,
    content_id: id,
    action,
    actor_id: user?.id ?? null,
    detail: detail ?? null,
  });
}

/** Delete something you wrote. */
export async function deleteOwnContent(kind: ContentKind, id: string, reason?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_content", {
    kind,
    target: id,
    reason: reason ?? null,
  });
  if (error) {
    return {
      error: error.message.includes("only delete your own")
        ? "You can only delete your own content."
        : error.message,
    };
  }

  await logAudit(kind, id, "deleted_by_author", reason);
  refresh();
  return { ok: true };
}

// ── Hub admin ──────────────────────────────────────────────────────────────

async function requireHub() {
  const user = await getCurrentUser();
  return user?.profile?.is_hub_admin ? user : null;
}

/** The Hub takes something down. */
export async function adminSoftDelete(kind: ContentKind, id: string, reason?: string): Promise<ActionResult> {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_content", {
    kind,
    target: id,
    reason: reason || "Removed by the Hub",
  });
  if (error) return { error: error.message };

  await logAudit(kind, id, "deleted_by_hub", reason);
  refresh();
  return { ok: true };
}

export async function adminRestore(kind: ContentKind, id: string): Promise<ActionResult> {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_content", { kind, target: id });
  if (error) return { error: error.message };

  await logAudit(kind, id, "restored_by_hub");
  refresh();
  return { ok: true };
}

/** Permanent removal. No undo. */
export async function adminPurge(kind: ContentKind, id: string): Promise<ActionResult> {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can do that." };

  const table =
    kind === "post" ? "posts" : kind === "blog" ? "blogs" : kind === "comment" ? "post_comments" : "reports";

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(kind, id, "purged");
  refresh();
  return { ok: true };
}

// ── Reports ────────────────────────────────────────────────────────────────
// Reporters delete their own; administrators can delete any, always with a
// reason, because the reporter loses sight of the case.

export async function adminDeleteReport(id: string, reason?: string): Promise<ActionResult> {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can delete a report." };

  const res = await adminSoftDelete("report", id, reason);
  if (res.error) return res;

  const admin = createAdminClient();
  await admin.from("report_audit_log").insert({
    report_id: id,
    viewed_by: hub.id,
    action: "deleted",
    notes: reason ?? null,
  });
  return { ok: true };
}

export async function adminRestoreReport(id: string): Promise<ActionResult> {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can restore a report." };

  const res = await adminRestore("report", id);
  if (res.error) return res;

  const admin = createAdminClient();
  await admin.from("report_audit_log").insert({
    report_id: id,
    viewed_by: hub.id,
    action: "restored",
  });
  return { ok: true };
}

export async function adminPurgeReport(id: string): Promise<ActionResult> {
  return adminPurge("report", id);
}
