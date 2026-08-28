"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

/** Notify every Hub admin that a new item is awaiting review. */
async function notifyHubAdmins(kind: "post" | "blog", preview: string, author?: string | null) {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("is_hub_admin", true);
  const rows = (admins ?? []).map((a) => ({
    user_id: a.id as string,
    type: "content_submitted",
    title: `New ${kind} awaiting review`,
    body: `${author || "A member"}: ${preview}`,
    link: kind === "blog" ? "/hub/blogs" : "/hub/posts",
    content_type: kind,
  }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

/** Send a notification to a single user. */
async function notifyUser(userId: string, type: string, title: string, body: string, link: string, content_type?: string, content_id?: string) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link, content_type, content_id });
}

async function logAudit(
  content_type: string,
  content_id: string,
  action: string,
  detail?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("content_audit_log").insert({
    content_type,
    content_id,
    action,
    actor_id: user?.id ?? null,
    detail: detail ?? null,
  });
}

// ── Member submissions ─────────────────────────────────────────────────────

interface MediaItem { type: "image" | "video" | "document"; url: string; name: string }

/** Normalise a YouTube URL to its watch URL, or null if it is not one. */
function normalizeYouTube(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (!m) return null;
  return `https://www.youtube.com/watch?v=${m[1]}`;
}

export async function createPost(
  body: string,
  media: MediaItem[] = [],
  opts: { pinned?: boolean; youtubeUrl?: string } = {},
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const isHub = !!user.profile?.is_hub_admin;

  // A YouTube link (admin feature) becomes a video media item.
  const finalMedia = [...media];
  if (opts.youtubeUrl) {
    const yt = normalizeYouTube(opts.youtubeUrl);
    if (!yt) return { error: "That does not look like a valid YouTube link." };
    finalMedia.push({ type: "video", url: yt, name: "YouTube video" });
  }

  if (body.trim().length < 3 && finalMedia.length === 0) return { error: "Write something or add media before posting." };

  const supabase = await createClient();
  const imageUrls = finalMedia.filter((m) => m.type === "image").map((m) => m.url);
  // Only Hub admins may pin, and only their own auto-published posts.
  const pinned = isHub && !!opts.pinned;
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    organization_id: user.membership?.organization_id ?? null,
    county_network_id: user.profile?.county_network_id ?? null,
    body: body.trim(),
    image_urls: imageUrls,
    media: finalMedia,
    is_hub: isHub,
    pinned,
    // Hub posts publish immediately; member posts wait for review.
    status: isHub ? "approved" : "pending",
  });
  if (error) return { error: error.message };
  // Notify Hub admins that a post is awaiting review.
  if (!isHub) await notifyHubAdmins("post", body.trim().slice(0, 60) || "New post", user.profile?.full_name);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  revalidatePath("/");
  return { ok: true };
}

export async function createBlog(
  input: { title: string; excerpt: string; body: string; cover_image_url?: string },
  opts: { asDraft?: boolean } = {},
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (input.title.trim().length < 3) return { error: "Give your story a title." };
  const isHub = !!user.profile?.is_hub_admin;
  // Drafts can be a work in progress; anything going out for review needs body.
  if (!opts.asDraft && input.body.replace(/<[^>]+>/g, "").trim().length < 30) {
    return { error: "Your story needs a little more content before it goes out." };
  }

  // Members: draft or submit for review. Hub admins publish immediately.
  const status = isHub ? "approved" : opts.asDraft ? "draft" : "pending";

  const supabase = await createClient();
  const { data, error } = await supabase.from("blogs").insert({
    author_id: user.id,
    organization_id: user.membership?.organization_id ?? null,
    county_network_id: user.profile?.county_network_id ?? null,
    title: input.title.trim(),
    excerpt: input.excerpt.trim() || input.body.replace(/<[^>]+>/g, "").trim().slice(0, 160),
    body: input.body.trim(),
    cover_image_url: input.cover_image_url || null,
    is_hub: isHub,
    status,
  }).select("id").single();
  if (error) return { error: error.message };
  if (status === "pending") await notifyHubAdmins("blog", input.title.trim(), user.profile?.full_name);
  revalidatePath("/dashboard");
  revalidatePath("/blog");
  revalidatePath("/");
  return { ok: true, id: data?.id as string | undefined, status };
}

/**
 * Author edits their own story while it is a draft or was declined, and can
 * (re)submit it for review. Never touches someone else's content or a story
 * that is already live/pending.
 */
export async function updateOwnBlog(
  id: string,
  input: { title: string; excerpt: string; body: string; cover_image_url?: string | null },
  opts: { submit?: boolean } = {},
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (input.title.trim().length < 3) return { error: "Give your story a title." };
  const supabase = await createClient();

  const { data: existing } = await supabase.from("blogs").select("author_id, status").eq("id", id).maybeSingle();
  if (!existing || existing.author_id !== user.id) return { error: "You can only edit your own stories." };
  if (!["draft", "rejected"].includes(existing.status as string)) {
    return { error: "This story is in review or already published and can't be edited here." };
  }
  if (opts.submit && input.body.replace(/<[^>]+>/g, "").trim().length < 30) {
    return { error: "Your story needs a little more content before it goes out." };
  }

  const status = opts.submit ? "pending" : "draft";
  const update: Record<string, unknown> = {
    title: input.title.trim(),
    excerpt: input.excerpt.trim() || input.body.replace(/<[^>]+>/g, "").trim().slice(0, 160),
    body: input.body.trim(),
    cover_image_url: input.cover_image_url ?? null,
    status,
  };
  // Clear the old decline note when resubmitting for a fresh review.
  if (opts.submit) update.review_notes = null;
  const { error } = await supabase.from("blogs").update(update).eq("id", id);
  if (error) return { error: error.message };
  if (opts.submit) await notifyHubAdmins("blog", input.title.trim(), user.profile?.full_name);
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true, status };
}

// ── Hub moderation ─────────────────────────────────────────────────────────

async function requireHub() {
  const user = await getCurrentUser();
  if (!user?.profile?.is_hub_admin) return null;
  return user;
}

export async function reviewContent(
  kind: "post" | "blog",
  id: string,
  decision: "approved" | "rejected",
  notes?: string,
) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can review content." };
  const supabase = await createClient();
  const table = kind === "post" ? "posts" : "blogs";
  const { data: row, error } = await supabase
    .from(table)
    .update({
      status: decision,
      review_notes: notes || null,
      reviewed_by: hub.id,
      // published_at is set by the DB trigger on approval
    })
    .eq("id", id)
    .select("author_id, title, body, slug")
    .single();
  if (error) return { error: error.message };
  await logAudit(kind, id, decision, notes);

  // Notify the author of the outcome.
  const authorId = row?.author_id as string | null;
  if (authorId) {
    const label = kind === "blog" ? (row?.title as string) || "your story" : (row?.body as string)?.slice(0, 50) || "your post";
    if (decision === "approved") {
      await notifyUser(authorId, "content_published", `Your ${kind} is live`, `"${label}" has been published to the feed.`,
        kind === "blog" ? `/blog/${row?.slug}` : "/feed", kind, id);
    } else {
      await notifyUser(authorId, "content_declined", `Your ${kind} was not approved`, notes || `"${label}" was reviewed and not published.`, "/profile", kind, id);
    }
  }

  revalidatePath("/hub");
  revalidatePath("/hub/posts");
  revalidatePath("/hub/blogs");
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/feed");
  return { ok: true };
}

/** Admin edits a post/blog before publishing. */
/**
 * Edit anybody's content.
 *
 * The Hub is answerable for what the platform publishes, so it can correct a
 * post, a story or a publication regardless of who wrote it. Every edit is
 * written to the audit log — a power to change someone else's words without a
 * record of having done so is not one worth having.
 */
export async function editContent(
  kind: "post" | "blog" | "resource",
  id: string,
  patch: {
    body?: string; title?: string; excerpt?: string; cover_image_url?: string | null;
    description?: string;
  },
) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can edit content." };
  const supabase = await createClient();
  const table = kind === "post" ? "posts" : kind === "blog" ? "blogs" : "resources";
  const update = kind === "post"
    ? { body: patch.body }
    : kind === "resource"
      ? {
          title: patch.title,
          description: patch.description ?? patch.excerpt,
          cover_image_url: patch.cover_image_url ?? null,
        }
    : { title: patch.title, excerpt: patch.excerpt, body: patch.body, cover_image_url: patch.cover_image_url ?? null };
  const { error } = await supabase.from(table).update(update).eq("id", id);
  if (error) return { error: error.message };
  await logAudit(kind, id, "edited");
  revalidatePath("/hub");
  revalidatePath("/hub/posts");
  revalidatePath("/hub/blogs");
  revalidatePath("/feed");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Pin anybody's content to the top of the feed.
 *
 * A publication carries `featured` rather than `pinned` — it predates the feed
 * and the library still calls it that — but both mean the same thing to a
 * reader, so the difference is absorbed here rather than leaked into the UI.
 */
export async function togglePin(
  kind: "post" | "blog" | "resource",
  id: string,
  pinned: boolean,
) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can pin content." };
  const supabase = await createClient();
  const table = kind === "post" ? "posts" : kind === "blog" ? "blogs" : "resources";
  const { error } = await supabase
    .from(table)
    .update(kind === "resource" ? { featured: pinned } : { pinned })
    .eq("id", id);
  if (error) return { error: error.message };
  await logAudit(kind, id, pinned ? "pinned" : "unpinned");
  revalidatePath("/hub");
  revalidatePath("/hub/posts");
  revalidatePath("/hub/blogs");
  revalidatePath("/resources");
  revalidatePath("/feed");
  revalidatePath("/");
  return { ok: true };
}

export async function verifyOrganization(
  id: string,
  decision: "verified" | "rejected" | "needs_more_info",
  notes?: string,
) {
  const hub = await requireHub();
  if (!hub) return { error: "Only the Hub can verify organisations." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      verification_status: decision,
      verification_notes: notes || null,
      verified_by: hub.id,
      verified_at: decision === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await logAudit("organization", id, decision, notes);
  revalidatePath("/hub");
  revalidatePath("/organizations");
  return { ok: true };
}
