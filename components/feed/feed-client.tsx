"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Composer } from "@/components/composer";
import { promptSignIn } from "@/lib/guest-reactions";
import { FeedView } from "@/components/feed/feed-view";
import type { FeedItem } from "@/lib/feed";

/**
 * Owns the compose modal for the feed so the composer can be opened from the
 * "What's on your mind" box, the action row beneath it, or a ?compose=1 link.
 */
export function FeedClient({
  feed,
  videos,
  signedIn,
  isHubAdmin = false,
  canPost = false,
  userName,
  avatarUrl,
  counties = [],
}: {
  feed: FeedItem[];
  videos: string[];
  signedIn: boolean;
  isHubAdmin?: boolean;
  canPost?: boolean;
  userName?: string | null;
  avatarUrl?: string | null;
  counties?: { name: string; slug: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  // ?compose=1 opens the composer. It is read straight from the URL rather
  // than copied into state by an effect, so there is no extra render pass and
  // no way for the two to disagree.
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);
  const open = manual || (params.get("compose") === "1" && !dismissed);
  const setOpen = (v: boolean) => {
    setManual(v);
    setDismissed(!v);
  };

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    if (params.get("compose")) router.replace(window.location.pathname);
  };

  const onCompose = () => {
    if (!signedIn) {
      promptSignIn("post");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <FeedView
        feed={feed}
        videos={videos}
        signedIn={signedIn}
        isHubAdmin={isHubAdmin}
        userName={userName}
        avatarUrl={avatarUrl}
        counties={counties}
        canPost={canPost}
        onCompose={onCompose}
      />

      {open && (
        <div
          className="fixed inset-0 z-[100] flex bg-black/60 sm:items-start sm:justify-center sm:p-4"
          onClick={close}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create a post"
            className="flex h-full w-full flex-col bg-surface shadow-2xl sm:mt-6 sm:h-auto sm:max-h-[88vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
              <p className="font-black text-ink">Create</p>
              <button onClick={close} aria-label="Close" className="text-muted hover:text-ink">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="feed-scroll flex-1 overflow-y-auto p-4">
              {canPost ? (
                <Composer
                  isHub={isHubAdmin}
                  onDone={() => {
                    router.refresh();
                    setTimeout(close, 900);
                  }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center">
                  <p className="font-semibold text-ink">Join a network first</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
                    Posting to the feed is for members of a county network. Complete your
                    profile and ask to join one, and your first post can go out for review
                    straight away.
                  </p>
                  <a
                    href="/onboarding"
                    className="mt-4 inline-flex h-11 items-center rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600"
                  >
                    Complete your profile
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
