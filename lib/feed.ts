import { createClient } from "@/lib/supabase/server";

export interface FeedAuthor {
  id: string | null;
  name: string;
  title: string | null;
  avatar_url: string | null;
}

/**
 * Who a post is *from*.
 *
 * A defender posts on behalf of her network, so the network is the author: its
 * name and its mark head the card, and the individual is credited underneath.
 * That is how the movement presents itself, and it means a post does not stop
 * making sense when one person moves on.
 *
 * `person` is still carried, because attribution matters and because the Hub's
 * moderation views need to know who actually wrote it.
 */
export interface FeedByline {
  /** The network the post belongs to: an organisation, or the Hub itself. */
  name: string;
  /** The organisation's own mark, falling back to the Hub logo. */
  logo_url: string | null;
  /** The county network the organisation sits in, if any. */
  county: string | null;
  /** True when the Hub posted as itself rather than a CBO. */
  isHub: boolean;
  /** The individual who wrote it, credited under the network. */
  person: FeedAuthor | null;
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
}

export interface FeedItem {
  kind: "post" | "blog" | "resource";
  id: string;
  slug?: string | null;
  title?: string | null;
  body: string;
  image: string | null;
  media: MediaItem[];
  author: FeedAuthor;
  /** The network the post is published as. Always present. */
  byline: FeedByline;
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
  /** Resources only: the document itself, and what kind of thing it is. */
  fileUrl?: string | null;
  docKind?: string | null;
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
  organizations?: OrgRef | OrgRef[] | null;
  county_networks?: { name: string } | { name: string }[] | null;
};

type OrgRef = { name: string; logo_url?: string | null };

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

/** The Hub's own mark, used when a post belongs to no CBO. */
const HUB_LOGO = "/main-logo.png";

/** A published document as the feed needs it. */
type ResourceRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  kind: string;
  cover_image_url: string | null;
  file_url: string;
  featured: boolean;
  published_on: string | null;
  created_at: string;
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

  const [{ data: posts }, { data: blogs }, { data: resources }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, author_id, body, image_urls, media, is_hub, pinned, status, deleted_at, deleted_reason, published_at, created_at, guest_name, guest_title, organizations(name, logo_url), county_networks(name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("blogs")
      .select(
        "id, author_id, title, slug, excerpt, cover_image_url, is_hub, pinned, status, deleted_at, deleted_reason, published_at, created_at, organizations(name, logo_url), county_networks(name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("resources")
      .select("id, title, slug, description, kind, cover_image_url, file_url, featured, published_on, created_at")
      .eq("published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const all: (Row & { kind: "post" | "blog" })[] = [
    ...((posts as Row[]) ?? []).map((r) => ({ ...r, kind: "post" as const })),
    ...((blogs as Row[]) ?? []).map((r) => ({ ...r, kind: "blog" as const })),
  ];

  // A Hub admin can read every row, but the feed is not a moderation queue: of
  // their own work, only what is live or awaiting review belongs here. Deleted
  // rows never reach a member at all — RLS drops them — so this is belt and
  // braces for the admin case.
  const rows = all.filter(
    (r) =>
      !r.deleted_at &&
      (r.status === "approved" || (!!userId && r.author_id === userId)),
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
      if (c.deleted_at) continue;
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
      });
      commentsByPost.set(pid, list);
      commentTotals.set(pid, (commentTotals.get(pid) ?? 0) + 1);
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

    const org = one(r.organizations);
    const county = one(r.county_networks)?.name ?? null;

    // The network is the author. A post from someone with no CBO yet still has
    // to be published as something, and the Hub is the honest answer: it is the
    // body that reviewed and approved it.
    const byline: FeedByline = r.is_hub
      ? { name: "WHRD Hub", logo_url: HUB_LOGO, county: null, isHub: true, person: null }
      : org
        ? {
            name: org.name,
            logo_url: org.logo_url ?? null,
            county,
            isHub: false,
            person: author,
          }
        : {
            name: county ? `WHRD Hub · ${county}` : "WHRD Hub",
            logo_url: HUB_LOGO,
            county,
            isHub: true,
            person: author,
          };

    return {
      kind: r.kind,
      id: r.id,
      slug: r.slug ?? null,
      title: r.title ?? null,
      body: r.kind === "post" ? (r.body ?? "") : (r.excerpt ?? ""),
      image: r.kind === "post" ? (r.image_urls?.[0] ?? null) : (r.cover_image_url ?? null),
      media: r.kind === "post" ? ((r.media as MediaItem[]) ?? []) : [],
      author,
      byline,
      org: org?.name ?? null,
      county,
      is_hub: r.is_hub,
      pinned: r.pinned,
      published_at: r.published_at ?? r.created_at,
      reactions: reactionCount.get(r.id) ?? 0,
      reactedByMe: reactedByMe.has(r.id),
      comments: commentsByPost.get(r.id) ?? [],
      commentCount: commentTotals.get(r.id) ?? 0,
      mine: !!userId && r.author_id === userId,
      pending: r.status === "pending",
    };
  });

  // Publications belong in the feed too.
  //
  // A report the Hub spent months on used to appear only in the library, where
  // somebody had to go looking for it. Adding it here is how the people the
  // work is for find out it exists.
  //
  // Note this is the publications library — resources.kind defaults to
  // 'Report'. Incident reports filed by survivors are private and are never
  // surfaced in any feed.
  const resourceItems: FeedItem[] = ((resources as ResourceRow[]) ?? []).map((r) => ({
    kind: "resource" as const,
    id: r.id,
    slug: r.slug ?? null,
    title: r.title,
    body: r.description ?? "",
    image: r.cover_image_url ?? null,
    media: [],
    author: HUB_AUTHOR,
    byline: {
      name: "WHRD Hub",
      logo_url: HUB_LOGO,
      county: null,
      isHub: true,
      person: null,
    },
    org: null,
    county: null,
    is_hub: true,
    pinned: r.featured,
    published_at: r.published_on ?? r.created_at,
    reactions: 0,
    reactedByMe: false,
    comments: [],
    commentCount: 0,
    mine: false,
    pending: false,
    fileUrl: r.file_url,
    docKind: r.kind,
  }));

  items.push(...resourceItems);

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return items.slice(0, limit);
}
