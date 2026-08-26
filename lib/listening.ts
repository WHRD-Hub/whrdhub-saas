import { createAdminClient } from "@/lib/supabase/admin";
import { matchKeywords, type Keyword, type RawItem } from "@/lib/meta";

/**
 * Match a batch of raw social items against the active keywords and store any
 * hits in listening_results (deduped on source + source_id). Runs with the
 * service role so it works from the webhook and the poller. New tables are not
 * in the generated DB types yet, so the query builder is accessed loosely.
 */
export async function ingestItems(items: RawItem[]): Promise<{ stored: number }> {
  if (!items.length) return { stored: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const { data: kw } = await db.from("listening_keywords").select("word, severity").eq("active", true);
  const keywords: Keyword[] = (kw ?? []).map((k: { word: string; severity: string }) => ({ word: k.word, severity: k.severity }));
  if (!keywords.length) return { stored: 0 };

  const rows = items
    .map((it) => {
      const { matched, severity } = matchKeywords(it.content, keywords);
      if (!matched.length) return null;
      return {
        source: it.source,
        source_id: it.source_id,
        permalink: it.permalink,
        author: it.author,
        content: it.content.slice(0, 2000),
        matched_keywords: matched,
        severity,
        status: "new",
      };
    })
    .filter(Boolean);

  if (!rows.length) return { stored: 0 };
  const { error } = await db.from("listening_results").upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return { stored: rows.length };
}
