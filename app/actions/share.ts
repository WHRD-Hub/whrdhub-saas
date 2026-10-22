"use server";

import { isXHost, xPost } from "@/lib/social-fetch";

/**
 * When someone shares a post from X, show what it says so they do not have to
 * copy it. X only, on purpose: it is read through X's own free embed, whereas
 * Instagram goes through a paid provider and this can be called without signing
 * in. For anything else the link is simply attached.
 */
export async function previewSharedPost(url: string): Promise<{ text: string; author: string | null } | null> {
  if (typeof url !== "string" || url.length > 500 || !isXHost(url)) return null;
  const r = await xPost(url);
  return r.post ? { text: r.post.text, author: r.post.author } : null;
}
