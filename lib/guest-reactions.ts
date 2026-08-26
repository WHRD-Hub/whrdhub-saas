"use client";

/**
 * Guest support (likes) stored in localStorage. A signed-out visitor can support
 * up to GUEST_LIMIT posts locally; attempting a further one triggers a sign-in
 * prompt. On sign in the stored ids are flushed to the database.
 */

export const GUEST_LIMIT = 3;
const KEY = "whrd-guest-likes";

export function getGuestLikes(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function isGuestLiked(id: string): boolean {
  return getGuestLikes().includes(id);
}

/**
 * Toggle a guest like.
 * - Removing a like always succeeds.
 * - Adding a like beyond GUEST_LIMIT is refused: returns { blocked: true }.
 */
export function toggleGuestLike(id: string): { liked: boolean; blocked: boolean; ids: string[] } {
  const ids = getGuestLikes();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    save(ids);
    return { liked: false, blocked: false, ids };
  }
  if (ids.length >= GUEST_LIMIT) {
    return { liked: false, blocked: true, ids };
  }
  ids.push(id);
  save(ids);
  return { liked: true, blocked: false, ids };
}

export function clearGuestLikes() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Why the sign-in prompt appeared, so its copy can say the right thing. */
export type SignInReason = "support-limit" | "comment" | "post";

export const SIGNIN_EVENT = "whrd-signin-prompt";

/** Ask the app to show the sign-in prompt. */
export function promptSignIn(reason: SignInReason = "support-limit") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SignInReason>(SIGNIN_EVENT, { detail: reason }));
  }
}
