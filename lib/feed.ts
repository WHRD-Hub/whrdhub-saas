import { createClient } from "@/lib/supabase/server";

export interface FeedAuthor {
  id: string | null;
  name: string;
  title: string | null;
  avatar_url: string | null;
}

export interface MediaItem {
  type: "image" | "video" | "document";
  url: string;
  name: string;
}

export interface FeedComment {
  id: string;
  body: string;
  author: FeedAuthor;
  created_at: string;
  mine: boolean;
  deleted: boolean;
}

export interface FeedItem {
  kind: "post" | "blog";
  id: string;
  slug?: string | null;
  title?: string | null;
  body: string;
  image: string | null;
  media: MediaItem[];
  author: FeedAuthor;
  org: string | null;
  county: string | null;
  is_hub: boolean;
  pinned: boolean;
  published_at: string;
  reactions: number;
  reactedByMe: boolean;
  comments: FeedComment[];
  commentCount: number;
  /** The signed-in person wrote this. */
  mine: boolean;
  /** Awaiting Hub review — only ever visible to the author. */
  pending: boolean;
  /** Soft-deleted. Shown to the author, greyed out, and to Hub admins. */
  deleted: boolean;
  deletedReason: string | null;
}

type Row = {
  id: string;
  author_id: string | null;
  body?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  image_urls?: string[] | null;
  media?: MediaItem[] | null;
  cover_image_url?: string | null;
  is_hub: boolean;
  pinned: boolean;
  status: string;
  deleted_at: string | null;
  deleted_reason?: string | null;
  published_at: string | null;
  created_at: string;
  guest_name?: string | null;
  guest_title?: string | null;
  organizations?: { name: string } | { name: string }[] | null;
  county_networks?: { name: string } | { name: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const HUB_AUTHOR: FeedAuthor = {
  id: null,
  name: "WHRD Hub",
  title: "National office",
  avatar_url: null,
};

const FALLBACK_AUTHOR: FeedAuthor = {
  id: null,
  name: "WHRD member",
  title: null,
  avatar_url: null,
};

/**
 * The feed.
 *
 * Everyone sees approved, undeleted posts and published stories. A signed-in
 * person additionally sees their own work whatever state it is in, so a post
 * awaiting review or one they deleted still appears to them, labelled. RLS
 * enforces that; the flags here are what the card renders from.
 */
export async function getFeed(limit = 40, userId?: string): Promise<FeedItem[]> {
  const supabase = await createClient();

  const [{ data: posts }, { data: blogs }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, author_id, body, image_urls, media, is_hub, pinned, status, deleted_at, deleted_reason, published_at, created_at, guest_name, guest_title, organizations(name), county_networks(name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("blogs")
      .select(
        "id, author_id, title, slug, excerpt, cover_image_url, is_hub, pinned, status, deleted_at, deleted_reason, published_at, created_at, organizations(name), county_networks(name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit * 2),
  ]);

  const all: (Row & { kind: "post" | "blog" })[] = [
    ...((posts as Row[]) ?? []).map((r) => ({ ...r, kind: "post" as const })),
    ...((blogs as Row[]) ?? []).map((r) => ({ ...r, kind: "blog" as const })),
  ];

  // A Hub admin can read every row, but the feed is not a moderation queue:
  // only the reader's own drafts and deletions belong here.
  const rows = all.filter(
    (r) =>
      (r.status === "approved" && !r.deleted_at) ||
      (!!userId && r.author_id === userId),
  );

  const ids = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean))) as string[];
  const authorMap = new Map<string, FeedAuthor>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, title, avatar_url")
      .in("id", ids);
    for (const p of profiles ?? []) {
      authorMap.set(p.id as string, {
        id: p.id as string,
        name: (p.full_name as string) || (p.username as string) || "WHRD member",
        title: (p.title as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
      });
    }
  }

  const postIds = rows.filter((r) => r.kind === "post").map((r) => r.id);

  const reactionCount = new Map<string, number>();
  const reactedByMe = new Set<string>();
  const commentsByPost = new Map<string, FeedComment[]>();
  const commentTotals = new Map<string, number>();

  if (postIds.length) {
    const [{ data: reactions }, { data: comments }] = await Promise.all([
      supabase.from("post_reactions").select("post_id, user_id").in("post_id", postIds),
      supabase
        .from("post_comments")
        .select("id, post_id, author_id, body, created_at, deleted_at, guest_name, guest_title")
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
    ]);

    for (const r of reactions ?? []) {
      const pid = r.post_id as string;
      reactionCount.set(pid, (reactionCount.get(pid) ?? 0) + 1);
      if (userId && r.user_id === userId) reactedByMe.add(pid);
    }

    // Comment authors may not be among the post authors already fetched.
    const commentAuthorIds = Array.from(
      new Set((comments ?? []).map((c) => c.author_id).filter(Boolean)),
    ) as string[];
    const missing = commentAuthorIds.filter((id) => !authorMap.has(id));
    if (missing.length) {
      const { data: more } = await supabase
        .from("profiles")
        .select("id, full_name, username, title, avatar_url")
        .in("id", missing);
      for (const p of more ?? []) {
        authorMap.set(p.id as string, {
          id: p.id as string,
          name: (p.full_name as string) || (p.username as string) || "WHRD member",
          title: (p.title as string) ?? null,
          avatar_url: (p.avatar_url as string) ?? null,
        });
      }
    }

    for (const c of comments ?? []) {
      const pid = c.post_id as string;
      const mine = !!userId && c.author_id === userId;
      const deleted = !!c.deleted_at;
      // A deleted comment stays visible to its author, marked; it counts for
      // nobody else.
      if (deleted && !mine) continue;
      const author =
        (c.author_id && authorMap.get(c.author_id as string)) ||
        (c.guest_name
          ? {
              id: null,
              name: c.guest_name as string,
              title: (c.guest_title as string) ?? null,
              avatar_url: null,
            }
          : FALLBACK_AUTHOR);
      const list = commentsByPost.get(pid) ?? [];
      list.push({
        id: c.id as string,
        body: c.body as string,
        author,
        created_at: c.created_at as string,
        mine,
        deleted,
      });
      commentsByPost.set(pid, list);
      if (!deleted) commentTotals.set(pid, (commentTotals.get(pid) ?? 0) + 1);
    }
  }

  const items: FeedItem[] = rows.map((r) => {
    const author = r.is_hub
      ? HUB_AUTHOR
      : (r.author_id && authorMap.get(r.author_id)) ||
        (r.guest_name
          ? {
              id: null,
              name: r.guest_name,
              title: r.guest_title ?? null,
              avatar_url: null,
            }
          : FALLBACK_AUTHOR);
    return {
      kind: r.kind,
      id: r.id,
      slug: r.slug ?? null,
      title: r.title ?? null,
      body: r.kind === "post" ? (r.body ?? "") : (r.excerpt ?? ""),
      image: r.kind === "post" ? (r.image_urls?.[0] ?? null) : (r.cover_image_url ?? null),
      media: r.kind === "post" ? ((r.media as MediaItem[]) ?? []) : [],
      author,
      org: one(r.organizations)?.name ?? null,
      county: one(r.county_networks)?.name ?? null,
      is_hub: r.is_hub,
      pinned: r.pinned,
      published_at: r.published_at ?? r.created_at,
      reactions: reactionCount.get(r.id) ?? 0,
      reactedByMe: reactedByMe.has(r.id),
      comments: commentsByPost.get(r.id) ?? [],
      commentCount: commentTotals.get(r.id) ?? 0,
      mine: !!userId && r.author_id === userId,
      pending: r.status === "pending",
      deleted: !!r.deleted_at,
      deletedReason: r.deleted_reason ?? null,
    };
  });

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return items.slice(0, limit);
}
