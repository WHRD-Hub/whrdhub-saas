import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The words and photographs a Hub super administrator has changed on the public
 * pages (edit mode). Server-only. See supabase/025_site_content.sql.
 *
 * A page names each editable spot with a stable key and keeps its own wording in
 * the code as the default; this only holds what someone has changed. So a key
 * missing here means "show what the code says".
 */
export const SITE_CONTENT_TAG = "site-content";

/** Set while a super administrator has edit mode on, so the landing page shows itself instead of redirecting. */
export const EDIT_COOKIE = "whrd-site-edit";

/** "home.hero.title", "about.values.2.body": lowercase, dots for nesting. */
export const SITE_KEY = /^[a-z0-9][a-z0-9._-]{0,119}$/;

export type SiteContentMap = Record<string, string>;

/**
 * Published content, shared by every visitor and cached until an editor publishes.
 * Never throws: a database problem must not take the public site down, so the
 * pages fall back to the wording in the code.
 */
export const getPublishedContent = unstable_cache(
  async (): Promise<SiteContentMap> => {
    try {
      const { data, error } = await createAdminClient()
        .from("site_content")
        .select("key, published")
        .not("published", "is", null);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.published as string]));
    } catch (e) {
      console.error("[site-content] could not read published content:", (e as Error).message);
      return {};
    }
  },
  ["site-content-published"],
  { tags: [SITE_CONTENT_TAG], revalidate: 3600 },
);

/** Every row, for editors: the draft they are working on and what is live. */
export async function getAllContent(): Promise<{ key: string; kind: string; draft: string | null; published: string | null }[]> {
  const { data, error } = await createAdminClient()
    .from("site_content")
    .select("key, kind, draft, published");
  if (error) throw new Error(error.message);
  return (data ?? []) as { key: string; kind: string; draft: string | null; published: string | null }[];
}
