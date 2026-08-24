"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";
import { storeInBucket, removeFromBucket, isStoredHere } from "@/lib/storage";

/**
 * Hub-admin management of the documents shown on /resources and /newsletter.
 * Everything here is admin-only; RLS on public.resources enforces the same rule
 * at the database level, so a stray client call cannot write.
 */

export interface ResourceInput {
  title: string;
  description?: string | null;
  kind: string;
  is_newsletter: boolean;
  cover_image_url?: string | null;
  file_url: string;
  edition_label?: string | null;
  published_on?: string | null;
  featured?: boolean;
  published?: boolean;
  sort_order?: number;
}

async function requireHub() {
  const user = await getCurrentUser();
  if (!user?.profile?.is_hub_admin) return null;
  return user;
}

async function logAudit(id: string, action: string, detail?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("content_audit_log").insert({
    content_type: "resource",
    content_id: id,
    action,
    actor_id: user?.id ?? null,
    detail: detail ?? null,
  });
}

/** Refresh every page that renders resources or newsletters. */
function revalidateAll() {
  revalidatePath("/resources");
  revalidatePath("/newsletter");
  revalidatePath("/hub/resources");
  revalidatePath("/");
}

function validate(input: ResourceInput): string | null {
  if (input.title.trim().length < 3) return "Give the document a title.";
  if (!input.file_url?.trim()) return "Upload the document, or paste a link to it.";
  if (!/^https?:\/\//i.test(input.file_url.trim())) return "The document link must start with http:// or https://";
  if (input.cover_image_url && !/^https?:\/\//i.test(input.cover_image_url.trim())) {
    return "The cover image link must start with http:// or https://";
  }
  return null;
}

/**
 * Every document and cover ends up in the publications bucket. A file uploaded
 * through the form is already there; a pasted link is fetched once and copied
 * in. If a copy fails we keep the original link and tell the admin why, rather
 * than refusing to save their work.
 */
async function storeFiles(input: ResourceInput) {
  const warnings: string[] = [];

  const doc = await storeInBucket(input.file_url, { folder: "documents", name: input.title });
  if (doc.warning) warnings.push(`Document: ${doc.warning}`);

  const cover = await storeInBucket(input.cover_image_url, {
    folder: "covers",
    name: `${input.title}-cover`,
  });
  if (cover.warning) warnings.push(`Cover image: ${cover.warning}`);

  return {
    file_url: doc.url,
    cover_image_url: cover.url || null,
    /** The link the admin pasted, kept for reference when we mirrored it. */
    source_url: doc.mirrored ? (input.file_url?.trim() ?? null) : null,
    warnings,
  };
}

function toRow(input: ResourceInput) {
  const isNewsletter = !!input.is_newsletter;
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    kind: isNewsletter ? "Newsletter" : input.kind || "Report",
    is_newsletter: isNewsletter,
    cover_image_url: input.cover_image_url?.trim() || null,
    file_url: input.file_url.trim(),
    edition_label: input.edition_label?.trim() || null,
    published_on: input.published_on || null,
    // Only a newsletter can be the featured "latest edition".
    featured: isNewsletter ? !!input.featured : false,
    published: input.published ?? true,
    sort_order: Number.isFinite(input.sort_order) ? Number(input.sort_order) : 0,
  };
}

/** Exactly one newsletter is the featured latest edition. */
async function clearOtherFeatured(exceptId: string) {
  const supabase = await createClient();
  await supabase
    .from("resources")
    .update({ featured: false })
    .eq("is_newsletter", true)
    .neq("id", exceptId);
}

export async function createResource(input: ResourceInput) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can add resources." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const stored = await storeFiles(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .insert({
      ...toRow(input),
      file_url: stored.file_url,
      cover_image_url: stored.cover_image_url,
      source_url: stored.source_url,
      created_by: hub.id,
    })
    .select("id, featured, is_newsletter")
    .single();
  if (error) return { error: error.message };

  const newId = data?.id as string | undefined;
  if (!newId) return { error: "The document was not saved. Please try again." };
  if (data?.is_newsletter && data?.featured) await clearOtherFeatured(newId);
  await logAudit(newId, "created", input.title.trim());
  revalidateAll();
  return { ok: true, id: newId, warnings: stored.warnings };
}

export async function updateResource(id: string, input: ResourceInput) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can edit resources." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();

  // What the row points at today, so replaced files can be cleaned up.
  const { data: before } = await supabase
    .from("resources")
    .select("file_url, cover_image_url")
    .eq("id", id)
    .maybeSingle();

  const stored = await storeFiles(input);
  const row = {
    ...toRow(input),
    file_url: stored.file_url,
    cover_image_url: stored.cover_image_url,
    source_url: stored.source_url,
  };
  const { error } = await supabase.from("resources").update(row).eq("id", id);
  if (error) return { error: error.message };

  // Delete the old bucket objects only once the row no longer references them.
  const oldDoc = before?.file_url as string | undefined;
  const oldCover = before?.cover_image_url as string | undefined;
  if (oldDoc && oldDoc !== row.file_url) await removeFromBucket(oldDoc);
  if (oldCover && oldCover !== row.cover_image_url) await removeFromBucket(oldCover);

  if (row.is_newsletter && row.featured) await clearOtherFeatured(id);
  await logAudit(id, "edited", row.title);
  revalidateAll();
  return { ok: true, warnings: stored.warnings };
}

/** Show or hide a document without deleting it. */
export async function toggleResourcePublished(id: string, published: boolean) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can publish resources." };
  const supabase = await createClient();
  const { error } = await supabase.from("resources").update({ published }).eq("id", id);
  if (error) return { error: error.message };
  await logAudit(id, published ? "published" : "unpublished");
  revalidateAll();
  return { ok: true };
}

/** Make this newsletter the latest edition shown at the top of /newsletter. */
export async function featureNewsletter(id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can feature a newsletter." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({ featured: true })
    .eq("id", id)
    .eq("is_newsletter", true);
  if (error) return { error: error.message };
  await clearOtherFeatured(id);
  await logAudit(id, "featured");
  revalidateAll();
  return { ok: true };
}

export async function deleteResource(id: string) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can delete resources." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("resources")
    .select("file_url, cover_image_url")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return { error: error.message };
  await removeFromBucket(row?.file_url as string | undefined);
  await removeFromBucket(row?.cover_image_url as string | undefined);
  await logAudit(id, "deleted");
  revalidateAll();
  return { ok: true };
}

/**
 * One-off (re-runnable) sweep: copy every document and cover that still lives
 * on an outside server into the publications bucket. Use it after seeding, or
 * any time the Resources page shows files hosted elsewhere.
 */
export async function backfillResourceFiles() {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can move files into storage." };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("resources")
    .select("id, title, file_url, cover_image_url");
  if (error) return { error: error.message };

  let moved = 0;
  let alreadyStored = 0;
  const problems: string[] = [];

  for (const row of rows ?? []) {
    const id = row.id as string;
    const title = (row.title as string) || "document";
    const currentDoc = (row.file_url as string) || "";
    const currentCover = (row.cover_image_url as string) || "";

    if (isStoredHere(currentDoc) && (!currentCover || isStoredHere(currentCover))) {
      alreadyStored += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};

    if (currentDoc && !isStoredHere(currentDoc)) {
      const res = await storeInBucket(currentDoc, { folder: "documents", name: title });
      if (res.mirrored) {
        patch.file_url = res.url;
        patch.source_url = currentDoc;
      } else if (res.warning) {
        problems.push(`${title}: ${res.warning}`);
      }
    }

    if (currentCover && !isStoredHere(currentCover)) {
      const res = await storeInBucket(currentCover, { folder: "covers", name: `${title}-cover` });
      if (res.mirrored) patch.cover_image_url = res.url;
      else if (res.warning) problems.push(`${title} cover: ${res.warning}`);
    }

    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase.from("resources").update(patch).eq("id", id);
      if (upErr) problems.push(`${title}: ${upErr.message}`);
      else {
        moved += 1;
        await logAudit(id, "stored", "copied into the publications bucket");
      }
    }
  }

  revalidateAll();
  return { ok: true, moved, alreadyStored, problems };
}
