"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { toggleReaction } from "@/app/actions/reactions";
import { isGuestLiked, toggleGuestLike, promptSignIn, subscribeGuestLikes } from "@/lib/guest-reactions";

/**
 * Shared support/like logic for the feed cards.
 * - Signed-in users hit the server action.
 * - Guests are stored in localStorage up to a small limit; exceeding it fires a
 *   sign-in prompt (handled globally by <SignInPrompt/>).
 *
 * `react(force)` returns true when the post ends up "liked" (so the caller can
 * play the double-tap heart burst). `force` = always-support (double-tap).
 */
export function useReaction({
  postId,
  signedIn,
  initialCount,
  initialReacted,
}: {
  postId: string;
  signedIn: boolean;
  initialCount: number;
  initialReacted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [signedReacted, setReacted] = useState(initialReacted);
  // A guest's like lives in localStorage, which is an external store: read it as one,
  // so it is correct after hydration without an effect copying it into state.
  const guestLiked = useSyncExternalStore(subscribeGuestLikes, () => isGuestLiked(postId), () => false);
  const reacted = signedIn ? signedReacted : guestLiked;

  const react = useCallback(
    (force?: boolean): boolean => {
      if (signedIn) {
        if (force && reacted) return true;
        const next = force ? true : !reacted;
        if (next === reacted) return next;
        setReacted(next);
        setCount((c) => c + (next ? 1 : -1));
        toggleReaction(postId).then((r) => {
          if (r.needsAuth) return;
          if (typeof r.count === "number") {
            setCount(r.count);
            setReacted(!!r.reacted);
          }
        });
        return next;
      }

      // Guest
      if (force && reacted) return true;
      const res = toggleGuestLike(postId);
      if (res.blocked) {
        promptSignIn();
        return false;
      }
      // The store notifies the hook, so `reacted` follows by itself.
      setCount((c) => c + (res.liked ? 1 : -1));
      return res.liked;
    },
    [signedIn, reacted, postId],
  );

  return { count, reacted, react };
}
