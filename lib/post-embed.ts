/**
 * Where a captured post can be shown as it appears on its own platform, photos
 * and all. These are the platforms' own embed pages (the same ones a website
 * embeds), so nothing is scraped to show a post: the viewer's browser loads it
 * directly, and only once they ask to.
 */
export interface PostEmbed { src: string; platform: "instagram" | "x" | "facebook"; height: number }

const hostIs = (u: URL, ...hosts: string[]) => hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));

export function postEmbed(permalink: string | null | undefined): PostEmbed | null {
  if (!permalink) return null;
  let u: URL;
  try { u = new URL(permalink); } catch { return null; }
  if (u.protocol !== "https:") return null;

  if (hostIs(u, "instagram.com")) {
    const m = /^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]{5,})/.exec(u.pathname);
    return m ? { platform: "instagram", src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`, height: 760 } : null;
  }
  if (hostIs(u, "x.com", "twitter.com")) {
    const m = /\/status(?:es)?\/(\d{5,25})/.exec(u.pathname);
    return m ? { platform: "x", src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true&theme=light`, height: 620 } : null;
  }
  if (hostIs(u, "facebook.com", "fb.com")) {
    return { platform: "facebook", src: `https://www.facebook.com/plugins/post.php?${new URLSearchParams({ href: u.toString(), show_text: "true", width: "500" })}`, height: 680 };
  }
  return null;
}
