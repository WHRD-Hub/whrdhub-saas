import { createAdminClient } from "@/lib/supabase/admin";
import { recentInstagramPosts, recentXPosts, recentFacebookPosts, instagramConfigured, socialEnabled } from "@/lib/social-fetch";
import { ingestItems } from "@/lib/listening";
import { broadcastToStaff } from "@/lib/alerts";
import { fetchRecentContent, metaConfigured } from "@/lib/meta";
import { ensurePacks } from "@/lib/listening-packs";
import type { RawItem } from "@/lib/meta";

/**
 * Listening that does not wait to be handed a link. An administrator lists
 * Instagram and X accounts and hashtags worth watching; a scan reads their
 * latest public posts (and the Hub's own Facebook page when it is connected),
 * runs them through the same keyword and triage as everything else, and keeps
 * what matters. It also notices when several captured posts point at the same
 * person, which is how a targeted campaign shows itself.
 *
 * Bounded on purpose: each source is one provider run, so a scan reads at most
 * MAX_SOURCES sources, the least recently scanned first. The daily job and the
 * "Scan now" button both come through scanAll.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

const MAX_SOURCES = Math.max(1, Math.min(15, Number(process.env.SOCIAL_DAILY_CAP) || 15));
const POSTS_PER_SOURCE = 10;
/** Captured posts naming the same account within a day before the team is warned. */
const BURST_AT = 3;

export interface Source {
  id: string;
  platform: "instagram" | "x" | "facebook";
  kind: "profile" | "hashtag";
  handle: string;
  note: string | null;
  index_all?: boolean | null;
  pack?: string | null;
  active: boolean;
  last_scanned_at: string | null;
  last_result: string | null;
}

export interface ScanSummary { sources: number; read: number; stored: number; bursts: number; message?: string }

/** The watched accounts and hashtags. */
export async function scanSources(onlyId?: string): Promise<ScanSummary> {
  const canInstagram = instagramConfigured();
  const canX = socialEnabled() && !!process.env.APIFY_TOKEN;
  if (!canInstagram && !canX) return { sources: 0, read: 0, stored: 0, bursts: 0 };

  const pick = (cols: string) => {
    let q = db().from("listening_sources").select(cols).eq("active", true);
    if (onlyId) q = q.eq("id", onlyId);
    return q.order("last_scanned_at", { ascending: true, nullsFirst: true }).limit(MAX_SOURCES);
  };
  let { data, error } = await pick("id, platform, kind, handle, index_all");
  // Before migration 020 there is no index_all column; scan as before.
  if (error) ({ data, error } = await pick("id, platform, kind, handle"));
  // The table is created by a migration; until then there is simply nothing watched.
  if (error) return { sources: 0, read: 0, stored: 0, bursts: 0 };

  let read = 0;
  let stored = 0;
  for (const src of (data ?? []) as Pick<Source, "id" | "platform" | "kind" | "handle" | "index_all">[]) {
    let result = "ok";
    try {
      const posts = src.platform === "x"
        ? await recentXPosts(src.kind, src.handle, POSTS_PER_SOURCE)
        : src.platform === "facebook"
          ? await recentFacebookPosts(src.handle, POSTS_PER_SOURCE)
          : await recentInstagramPosts(src.kind, src.handle, POSTS_PER_SOURCE);
      read += posts.length;
      const items: RawItem[] = posts.map((p) => ({ source: p.source, source_id: p.sourceId, permalink: p.url, author: p.author, content: p.text }));
      const r = await ingestItems(items, { triage: true, index: src.index_all ? "relevant" : undefined });
      stored += r.stored;
      result = `${posts.length} read, ${r.stored} new`;
    } catch (err) {
      result = `could not be read${err instanceof Error ? ` (${err.message.slice(0, 40)})` : ""}`;
    }
    await db().from("listening_sources").update({ last_scanned_at: new Date().toISOString(), last_result: result }).eq("id", src.id);
  }

  return { sources: (data ?? []).length, read, stored, bursts: 0 };
}

/**
 * Everything, across social media: the Hub's Facebook page (when connected),
 * every watched Instagram and X account or hashtag, then a check for campaigns.
 */
export async function scanAll(): Promise<ScanSummary> {
  // Preset accounts and words exist from the first scan, without anyone opening the page first.
  await ensurePacks().catch(() => null);

  let read = 0;
  let stored = 0;

  if (metaConfigured()) {
    try {
      const items = await fetchRecentContent();
      read += items.length;
      stored += (await ingestItems(items, { triage: true })).stored;
    } catch (err) {
      console.error("[listening] Facebook page scan failed:", err instanceof Error ? err.message : err);
    }
  }

  const watched = await scanSources();
  read += watched.read;
  stored += watched.stored;
  const bursts = await detectBursts();

  const nothing = read === 0 && watched.sources === 0 && !metaConfigured();
  return {
    sources: watched.sources, read, stored, bursts,
    message: nothing ? "There is nothing to scan yet. Add an account or hashtag to watch, or paste links to check." : undefined,
  };
}

/**
 * When several captures in the last day all name the same account, warn the
 * team once. Three posts about one defender is a pattern, not a coincidence.
 */
export async function detectBursts(): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db()
    .from("listening_results")
    .select("id, content, status")
    .gt("captured_at", since)
    .neq("status", "dismissed")
    .limit(500);

  const byHandle = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { id: string; content: string }[]) {
    for (const m of r.content.matchAll(/@([A-Za-z0-9._]{2,30})/g)) {
      const h = m[1].toLowerCase();
      if (!byHandle.has(h)) byHandle.set(h, new Set());
      byHandle.get(h)!.add(r.id);
    }
  }

  let sent = 0;
  for (const [handle, ids] of byHandle) {
    if (ids.size < BURST_AT) continue;
    const ok = await broadcastToStaff({
      type: "listening_burst",
      title: `Possible campaign against @${handle}`,
      body: `${ids.size} captured posts in the last day name this account. Review them together.`,
      path: "/hub/reporting/listening",
      tag: `burst-${handle}`,
    });
    if (ok) sent++;
  }
  return sent;
}
