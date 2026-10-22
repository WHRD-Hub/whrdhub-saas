import { createAdminClient } from "@/lib/supabase/admin";
import { matchKeywords, type Keyword, type RawItem } from "@/lib/meta";
import { isActionable, triagePosts, type Triage } from "@/lib/listening-triage";

/**
 * Match a batch of raw social items against the active keywords and store the
 * ones worth a person's attention in listening_results (deduped on source +
 * source_id). Runs with the service role so it works from the webhook and the
 * poller. New tables are not in the generated DB types yet, so the query
 * builder is accessed loosely.
 *
 * With `triage` on, Jev also judges each post (a real case, abuse aimed at
 * someone, awareness, or not relevant). That has two effects: a post with no
 * watched word but which clearly is a case is kept, and one that only matched a
 * word in another sense is labelled "likely not relevant" so it sinks. Nothing
 * is ever dismissed automatically.
 */
export async function ingestItems(
  incoming: RawItem[],
  opts: {
    triage?: boolean;
    /**
     * Which posts are kept besides those that match a watched word or are clearly a case:
     *   "relevant"  everything except posts confidently judged not relevant (a preset account such as Usikimye)
     *   "all"       everything, because a person handed it over on purpose (Check a post)
     */
    index?: "relevant" | "all";
  } = {},
): Promise<{ stored: number; triaged: number; existing: number; read: number }> {
  if (!incoming.length) return { stored: 0, triaged: 0, existing: 0, read: 0 };
  let items = incoming;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Accounts an administrator has paused stay on the list but are never listened to: their posts are
  // skipped wherever they turn up (hashtag scans, pasted links, the Facebook page). Nothing already stored is touched.
  const { data: paused } = await db.from("listening_sources").select("platform, handle").eq("kind", "profile").eq("active", false);
  const mutedAccounts = new Set(((paused ?? []) as { platform: string; handle: string }[]).map((p) => `${p.platform}:${p.handle.toLowerCase()}`));
  // A post someone pasted in on purpose is kept even if its account is paused.
  if (opts.index !== "all") items = items.filter((it) => !mutedAccounts.has(`${it.source}:${(it.author ?? "").replace(/^@/, "").toLowerCase()}`));
  if (!items.length) return { stored: 0, triaged: 0, existing: 0, read: incoming.length };

  const { data: kw } = await db.from("listening_keywords").select("word, severity").eq("active", true);
  const keywords: Keyword[] = (kw ?? []).map((k: { word: string; severity: string }) => ({ word: k.word, severity: k.severity }));

  const judged = opts.triage ? await triagePosts(items.map((it) => it.content)) : items.map(() => null as Triage | null);

  const rows = items
    .map((it, i) => {
      const { matched, severity } = matchKeywords(it.content, keywords);
      const t = judged[i];
      const confidentlyIrrelevant = t?.cls === "not_relevant" && t.confidence >= 0.6;
      const indexed = opts.index === "all" || (opts.index === "relevant" && !confidentlyIrrelevant);
      if (!matched.length && !isActionable(t) && !indexed) return null;

      // A word match sets the floor; a confident case, or a missing person, can only raise it.
      let sev = matched.length ? severity : t?.cls === "awareness" || t?.cls === "not_relevant" ? "low" : "medium";
      if ((t?.cls === "real_incident" || t?.cls === "missing_person") && t.confidence >= 0.6) sev = "high";
      return {
        source: it.source,
        source_id: it.source_id,
        permalink: it.permalink,
        author: it.author,
        content: it.content.slice(0, 2000),
        matched_keywords: matched,
        severity: sev,
        status: "new",
        ...(t ? { ai_class: t.cls, ai_confidence: t.confidence } : {}),
      };
    })
    .filter(Boolean);

  if (!rows.length) return { stored: 0, triaged: judged.filter(Boolean).length, existing: 0, read: incoming.length };

  // Skip anything already in the inbox. This is done here rather than with ON CONFLICT because the
  // table's unique index on (source, source_id) is a partial one, and Postgres cannot use a partial index
  // as the target of an upsert ("no unique or exclusion constraint matching the ON CONFLICT specification").
  const ids = [...new Set((rows as { source_id: string }[]).map((r) => r.source_id))];
  const { data: have } = await db.from("listening_results").select("source, source_id").in("source_id", ids);
  const seen = new Set(((have ?? []) as { source: string; source_id: string }[]).map((h) => `${h.source}:${h.source_id}`));
  const fresh = (rows as Record<string, unknown>[]).filter((r) => !seen.has(`${r.source}:${r.source_id}`));
  if (!fresh.length) return { stored: 0, triaged: judged.filter(Boolean).length, existing: rows.length, read: incoming.length };

  const insert = (list: Record<string, unknown>[]) => db.from("listening_results").insert(list).select("id");
  let { data: inserted, error } = await insert(fresh);
  // Migration 017 adds the ai_* columns. Until it is applied, store the capture without them rather than lose it.
  if (error && /ai_class|ai_confidence/i.test(error.message)) {
    const plain = fresh.map((row) => {
      const copy = { ...row };
      delete copy.ai_class;
      delete copy.ai_confidence;
      return copy;
    });
    ({ data: inserted, error } = await insert(plain));
  }
  // Two scans can race to store the same post; the unique index refuses the second. Keep what can be kept.
  if (error && error.code === "23505") {
    inserted = [];
    for (const row of fresh) {
      const one = await db.from("listening_results").insert(row).select("id");
      if (!one.error) inserted.push(...(one.data ?? []));
    }
    error = null;
  }
  if (error) throw new Error(error.message);
  const stored = (inserted ?? []).length;
  return { stored, triaged: judged.filter(Boolean).length, existing: rows.length - stored, read: incoming.length };
}
