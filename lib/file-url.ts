/**
 * Serve stored files from the Hub's own domain.
 *
 * Uploads live in Supabase Storage, and Supabase hands back an absolute URL on
 * its own host. That URL is what gets written to the database, so a visitor who
 * opens a publication sees `<project-ref>.supabase.co` in the address bar — the
 * Hub's own report, apparently published by somebody else.
 *
 * `next.config.ts` proxies `/files/*` to the public storage endpoint. This maps
 * a stored Supabase URL onto that path at render time, which means nothing in
 * the database has to change and every URL already saved starts working under
 * the Hub's domain immediately.
 *
 * Anything that is not a public object on this project's Supabase host is
 * returned untouched: an external link stays external, and a signed URL for
 * report evidence keeps its signature and its expiry.
 */

const PUBLIC_PREFIX = "/storage/v1/object/public/";

export const HUB_FILE_PREFIX = "/files/";

export function hubFile(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith(HUB_FILE_PREFIX)) return url;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return url;

  try {
    const u = new URL(url);
    if (u.host !== new URL(base).host) return url;

    const at = u.pathname.indexOf(PUBLIC_PREFIX);
    if (at === -1) return url; // signed or authenticated object: leave it alone
    return HUB_FILE_PREFIX + u.pathname.slice(at + PUBLIC_PREFIX.length) + u.search;
  } catch {
    return url;
  }
}

/**
 * The absolute form, for anywhere a URL leaves the page: Open Graph tags, feed
 * enclosures, an email. Falls back to the mapped path when the site URL is not
 * configured, which is correct for a relative link on the same origin.
 */
export function hubFileAbsolute(url: string | null | undefined): string {
  const mapped = hubFile(url);
  if (!mapped.startsWith(HUB_FILE_PREFIX)) return mapped;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return site ? `${site.replace(/\/$/, "")}${mapped}` : mapped;
}

/**
 * The same mapping, applied to URLs embedded in stored rich text.
 *
 * A story's body is HTML written in the editor, and any image dropped into it
 * carries the absolute Supabase URL it was uploaded to. Those live inside the
 * markup rather than in a column, so they need rewriting on the way out.
 *
 * Deliberately narrow: it matches only this project's public storage prefix,
 * inside an attribute value. It is not an HTML parser and is not trying to be
 * -- anything it does not recognise is left exactly as written.
 */
export function hubFileHtml(html: string | null | undefined): string {
  if (!html) return "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return html;

  let host: string;
  try {
    host = new URL(base).host;
  } catch {
    return html;
  }

  const pattern = new RegExp(
    `(src|href)=("|')https?://${host.replace(/\./g, "\\.")}${PUBLIC_PREFIX}`,
    "gi",
  );
  return html.replace(pattern, `$1=$2${HUB_FILE_PREFIX}`);
}
