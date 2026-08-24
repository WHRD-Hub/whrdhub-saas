import { createClient } from "@/lib/supabase/server";
import { RESOURCES as STATIC_RESOURCES, NEWSLETTER as STATIC_NEWSLETTER } from "@/lib/site-content";
import type { ResourceItem } from "@/lib/resource-types";

export { RESOURCE_KINDS, resourceDate } from "@/lib/resource-types";
export type { ResourceItem } from "@/lib/resource-types";

/**
 * Resources and newsletters are Hub-admin managed rows in `public.resources`
 * (see supabase/011_resources.sql). Until that migration is run the public
 * pages fall back to the original hard-coded lists in lib/site-content.ts, so
 * nothing ever renders empty.
 */

const SELECT =
  "id, title, slug, description, kind, is_newsletter, cover_image_url, file_url, edition_label, published_on, featured, published, sort_order";

function fallbackResources(): ResourceItem[] {
  return STATIC_RESOURCES.map((r, i) => ({
    id: `static-${i}`,
    title: r.title,
    slug: null,
    description: null,
    kind: r.kind,
    is_newsletter: false,
    cover_image_url: r.cover,
    file_url: r.pdf,
    edition_label: null,
    published_on: null,
    featured: false,
    published: true,
    sort_order: i * 10,
  }));
}

function fallbackNewsletters(): ResourceItem[] {
  return [
    {
      id: "static-newsletter",
      title: STATIC_NEWSLETTER.title,
      slug: null,
      description: `${STATIC_NEWSLETTER.subtitle}. Read the latest edition for stories and updates from across the movement.`,
      kind: "Newsletter",
      is_newsletter: true,
      cover_image_url: STATIC_NEWSLETTER.cover,
      file_url: STATIC_NEWSLETTER.pdf,
      edition_label: "Latest edition",
      published_on: null,
      featured: true,
      published: true,
      sort_order: 10,
    },
  ];
}

/** Published, non-newsletter documents for /resources. */
export async function getPublishedResources(): Promise<ResourceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(SELECT)
    .eq("published", true)
    .eq("is_newsletter", false)
    .order("sort_order", { ascending: true })
    .order("published_on", { ascending: false, nullsFirst: false });
  if (error || !data) return fallbackResources();
  return data.length ? (data as ResourceItem[]) : fallbackResources();
}

/** Published newsletter editions for /newsletter, newest/featured first. */
export async function getPublishedNewsletters(): Promise<ResourceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .select(SELECT)
    .eq("published", true)
    .eq("is_newsletter", true)
    .order("featured", { ascending: false })
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error || !data) return fallbackNewsletters();
  return data.length ? (data as ResourceItem[]) : fallbackNewsletters();
}

/** Everything, published or not — the Hub console list. */
export async function getAllResources(): Promise<ResourceItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select(SELECT)
    .order("is_newsletter", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("published_on", { ascending: false, nullsFirst: false });
  return (data as ResourceItem[]) ?? [];
}

export async function getResource(id: string): Promise<ResourceItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("resources").select(SELECT).eq("id", id).maybeSingle();
  return (data as ResourceItem) ?? null;
}
