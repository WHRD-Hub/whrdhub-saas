import { createAdminClient } from "@/lib/supabase/admin";
import { extractTags } from "@/lib/hashtags";

/**
 * Hashtags that keep turning up in what the team has already captured, offered
 * as hashtags to listen to. Nothing is added by itself: an administrator says
 * yes or no, and a no is remembered so the same tag is not offered again.
 */
export interface TagSuggestion {
  tag: string;
  /** Captures that carry the tag. */
  posts: number;
  /** Different accounts behind them, so one account repeating itself does not count as a trend. */
  accounts: number;
  /** Platforms the tag was seen on. */
  seenOn: string[];
}

const WINDOW_DAYS = 14;
const MIN_POSTS = 3;
const MIN_ACCOUNTS = 2;
const MAX_SHOWN = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function suggestTags(): Promise<TagSuggestion[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("listening_results")
    .select("source, author, content, status, ai_class")
    .gt("captured_at", since)
    .neq("status", "dismissed")
    .order("captured_at", { ascending: false })
    .limit(2000);
  if (error || !data) return [];

  const watched = new Set<string>();
  const { data: src } = await db().from("listening_sources").select("handle").eq("kind", "hashtag");
  for (const s of (src ?? []) as { handle: string }[]) watched.add(s.handle.toLowerCase());
  // Before migration 022 nothing can be remembered as declined.
  const declined = new Set<string>();
  const { data: no } = await db().from("listening_tag_declines").select("tag");
  for (const d of (no ?? []) as { tag: string }[]) declined.add(d.tag.toLowerCase());

  const seen = new Map<string, { posts: number; accounts: Set<string>; on: Set<string> }>();
  for (const r of data as { source: string; author: string | null; content: string; ai_class: string | null }[]) {
    if (r.ai_class === "not_relevant") continue;
    for (const tag of extractTags(r.content)) {
      if (watched.has(tag) || declined.has(tag)) continue;
      const e = seen.get(tag) ?? { posts: 0, accounts: new Set<string>(), on: new Set<string>() };
      e.posts++;
      e.accounts.add((r.author ?? "").toLowerCase());
      e.on.add(r.source);
      seen.set(tag, e);
    }
  }
  return [...seen.entries()]
    .filter(([, e]) => e.posts >= MIN_POSTS && e.accounts.size >= MIN_ACCOUNTS)
    .map(([tag, e]) => ({ tag, posts: e.posts, accounts: e.accounts.size, seenOn: [...e.on] }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, MAX_SHOWN);
}
