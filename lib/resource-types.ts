/**
 * Shared shape for the documents on /resources and /newsletter.
 * Kept free of server-only imports so client components (the admin form) can
 * use it too. The data-fetching helpers live in lib/resources.ts.
 */

export interface ResourceItem {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  kind: string;
  is_newsletter: boolean;
  cover_image_url: string | null;
  file_url: string;
  edition_label: string | null;
  published_on: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

/** The kinds offered in the admin form. Free text in the DB, so this can grow. */
export const RESOURCE_KINDS = [
  "Report",
  "Research",
  "Guide",
  "Policy brief",
  "Toolkit",
  "Photo book",
  "Statement",
  "Newsletter",
  "Other",
] as const;

/** "March 2025" — a short, readable date for a document. */
export function resourceDate(item: ResourceItem): string | null {
  if (item.edition_label) return item.edition_label;
  if (!item.published_on) return null;
  const d = new Date(item.published_on);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}
