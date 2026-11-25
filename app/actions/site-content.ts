"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { EDIT_COOKIE, SITE_CONTENT_TAG, SITE_KEY, getAllContent } from "@/lib/site-content-store";

/**
 * Edit mode for the public pages. Only a Hub super administrator
 * (profiles.is_hub_admin) may read drafts or change anything; every action checks
 * that again on the server, whatever the browser claims.
 */

export type EditResult = { ok: true } | { ok: false; error: string };
export type EditorState =
  | { canEdit: false }
  | { canEdit: true; draft: Record<string, string | null>; published: Record<string, string | null> };

const MAX_TEXT = 20000;
// An image must be one uploaded through edit mode (served by the site's own /files),
// so a draft can never point the public site at somebody else's server.
const SITE_IMAGE = /^\/files\/publications\/site\/[A-Za-z0-9._%-]+$/;

async function editor(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || user.isDeleted || user.isBanned || !user.profile?.is_hub_admin) return null;
  return user.id;
}

const denied: EditResult = { ok: false, error: "Only a Hub super administrator can edit the website." };

export async function getEditorState(): Promise<EditorState> {
  if (!(await editor())) return { canEdit: false };
  const rows = await getAllContent();
  return {
    canEdit: true,
    draft: Object.fromEntries(rows.map((r) => [r.key, r.draft])),
    published: Object.fromEntries(rows.map((r) => [r.key, r.published])),
  };
}

/** Turn edit mode on or off for this browser. */
export async function setEditMode(on: boolean): Promise<EditResult> {
  if (on && !(await editor())) return denied;
  const jar = await cookies();
  if (on) jar.set(EDIT_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  else jar.delete(EDIT_COOKIE);
  return { ok: true };
}

/**
 * Save one change as a draft. `value` null puts the spot back to what the page's
 * code says. Nothing reaches visitors until publishDrafts().
 */
export async function saveDraft(key: string, kind: "text" | "image", value: string | null): Promise<EditResult> {
  const uid = await editor();
  if (!uid) return denied;
  if (!SITE_KEY.test(key)) return { ok: false, error: "That part of the page cannot be edited." };
  if (kind !== "text" && kind !== "image") return { ok: false, error: "Unknown kind of content." };
  if (value !== null) {
    if (kind === "text") {
      value = value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
      if (value.length > MAX_TEXT) return { ok: false, error: "That text is too long." };
    } else if (!SITE_IMAGE.test(value)) {
      return { ok: false, error: "Upload the photo through edit mode first." };
    }
  }

  const db = createAdminClient();
  const { error } = await db
    .from("site_content")
    .upsert({ key, kind, draft: value, updated_by: uid, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: "Could not save that change. Please try again." };
  return { ok: true };
}

/** Make every draft live. */
export async function publishDrafts(): Promise<EditResult & { count?: number }> {
  const uid = await editor();
  if (!uid) return denied;
  const rows = await getAllContent();
  const changed = rows.filter((r) => (r.draft ?? null) !== (r.published ?? null));
  if (!changed.length) return { ok: true, count: 0 };

  const db = createAdminClient();
  const now = new Date().toISOString();
  for (const r of changed) {
    const { error } = await db
      .from("site_content")
      .update({ published: r.draft, published_at: now, updated_by: uid, updated_at: now })
      .eq("key", r.key);
    if (error) return { ok: false, error: "Some changes could not be published. Please try again." };
  }
  // Rows put back to the page's own wording on both sides no longer say anything.
  await db.from("site_content").delete().is("draft", null).is("published", null);

  updateTag(SITE_CONTENT_TAG);
  revalidatePath("/", "layout");
  return { ok: true, count: changed.length };
}

/** Throw away every unpublished change. */
export async function discardDrafts(): Promise<EditResult> {
  if (!(await editor())) return denied;
  const db = createAdminClient();
  const rows = await getAllContent();
  for (const r of rows.filter((x) => (x.draft ?? null) !== (x.published ?? null))) {
    const { error } = await db.from("site_content").update({ draft: r.published }).eq("key", r.key);
    if (error) return { ok: false, error: "Could not discard the changes. Please try again." };
  }
  await db.from("site_content").delete().is("draft", null).is("published", null);
  return { ok: true };
}

/** Photos already uploaded through edit mode, newest first, to reuse one. */
export async function listSiteImages(): Promise<{ ok: true; images: string[] } | { ok: false; error: string }> {
  if (!(await editor())) return { ok: false, error: "Only a Hub super administrator can edit the website." };
  const rows = await getAllContent();
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.kind !== "image") continue;
    for (const v of [r.draft, r.published]) if (v && SITE_IMAGE.test(v)) seen.add(v);
  }
  return { ok: true, images: [...seen].sort().reverse() };
}
