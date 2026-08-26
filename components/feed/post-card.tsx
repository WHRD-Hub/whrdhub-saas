"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, Globe2, MoreHorizontal, X, ThumbsUp, MessageCircle,
  Share2, Pin, BookOpen, Trash2, Clock, Loader2,
} from "lucide-react";
import { useReaction } from "@/lib/use-reaction";
import { promptSignIn } from "@/lib/guest-reactions";
import { timeAgo, cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/field";
import { NetworkAvatar } from "@/components/feed/network-avatar";
import { MediaBlock } from "@/components/feed/media-block";
import { CommentThread } from "@/components/feed/comment-thread";
import { deleteOwnContent, adminSoftDelete } from "@/app/actions/lifecycle";
import { toast } from "@/components/ui/toast";
import type { FeedItem } from "@/lib/feed";

const CLAMP_AT = 280;

/** Body text with a "See more" fold, matching how a long post reads in a feed. */
function Body({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_AT;
  const shown = open || !long ? text : text.slice(0, CLAMP_AT).trimEnd();
  return (
    <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-relaxed text-ink">
      {shown}
      {long && !open && (
        <>
          …{" "}
          <button
            onClick={() => setOpen(true)}
            className="font-semibold text-muted hover:underline"
          >
            See more
          </button>
        </>
      )}
    </p>
  );
}

function StateBanner({ item }: { item: FeedItem }) {
  if (item.pending) {
    return (
      <div className="flex items-start gap-2 border-b border-line bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-bold">Awaiting review.</span> The Hub will publish this to the
          feed once it has been checked. Only you can see it for now.
        </span>
      </div>
    );
  }
  return null;
}

export function PostCard({
  item,
  signedIn,
  isHubAdmin = false,
  onShare,
}: {
  item: FeedItem;
  signedIn: boolean;
  isHubAdmin?: boolean;
  onShare: (title: string, url: string) => void;
}) {
  const isBlog = item.kind === "blog";
  const { count, reacted, react } = useReaction({
    postId: item.id,
    signedIn,
    initialCount: item.reactions,
    initialReacted: item.reactedByMe,
  });
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const lastTap = useRef(0);

  const doReact = useCallback(
    (force?: boolean) => {
      react(force);
    },
    [react],
  );

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) doReact(true);
    lastTap.current = now;
  };

  const kind = isBlog ? "blog" : "post";
  const shareUrl = isBlog ? `/blog/${item.slug}` : `/feed#${item.id}`;

  const run = async (fn: () => Promise<{ error?: string; ok?: boolean }>, done: string) => {
    setBusy(true);
    setMenu(false);
    const res = await fn();
    setBusy(false);
    if (res?.error) toast.error(res.error);
    else toast.success(done);
  };

  if (hidden) {
    return (
      <article className="rounded-xl border border-line bg-surface p-4 text-center text-sm text-muted">
        Hidden from your feed.{" "}
        <button onClick={() => setHidden(false)} className="font-semibold text-purple hover:underline">
          Undo
        </button>
      </article>
    );
  }

  return (
    <article
      id={item.id}
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.06)]",
      )}
    >
      <StateBanner item={item} />

      {/* Header — the network is the author; the person who wrote it is
          credited underneath, with their own avatar at a smaller size. */}
      <header className="flex items-start gap-2.5 p-3 pb-2">
        <NetworkAvatar
          name={item.byline.name}
          logoUrl={item.byline.logo_url}
          isHub={item.byline.isHub}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight">
            <span className="font-semibold text-ink">{item.byline.name}</span>
            <BadgeCheck
              className="ml-1 inline h-4 w-4 -translate-y-px text-purple"
              aria-label="Verified network"
            />
            {item.byline.county && (
              <span className="text-ink/70">
                {" "}
                is in <span className="font-semibold text-ink">{item.byline.county}</span>.
              </span>
            )}
          </p>

          {item.byline.person && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <Avatar
                name={item.byline.person.name}
                src={item.byline.person.avatar_url}
                size={16}
              />
              <span className="truncate">
                Posted by{" "}
                <span className="font-semibold text-ink/80">{item.byline.person.name}</span>
                {item.byline.person.title ? `, ${item.byline.person.title}` : ""}
              </span>
            </p>
          )}

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span>{timeAgo(item.published_at)}</span>
            <span aria-hidden>·</span>
            <Globe2 className="h-3 w-3" aria-label="Public" />
          </p>
        </div>

        {item.pinned && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-purple/20 bg-purple-050 px-2 py-0.5 text-xs font-semibold text-purple-700">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}

        <div className="relative shrink-0">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Post options"
            aria-expanded={menu}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-purple-050 hover:text-ink"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
              <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                {item.mine && (
                  <button
                    onClick={() => run(() => deleteOwnContent(kind, item.id), `Your ${kind} was deleted.`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete {kind}
                  </button>
                )}
                {isHubAdmin && !item.mine && (
                  <button
                    onClick={() => run(() => adminSoftDelete(kind, item.id), "Removed from the feed.")}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Remove as Hub admin
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenu(false);
                    onShare(item.title || item.body.slice(0, 80), shareUrl);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-purple-050"
                >
                  <Share2 className="h-4 w-4" /> Copy link
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setHidden(true)}
          aria-label="Hide this post"
          className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-purple-050 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Body */}
      <div onDoubleClick={() => doReact(true)} onTouchEnd={onTap} className="select-none">
        {isBlog ? (
          <div className="px-4 pb-3">
            <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan-050 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
              <BookOpen className="h-3 w-3" /> Story
            </span>
            <h3 className="font-bold leading-snug text-ink">{item.title}</h3>
            {item.body && <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>}
          </div>
        ) : (
          item.body && <Body text={item.body} />
        )}

        {!isBlog && item.media.length > 0 ? (
          <div className="px-4 pb-3">
            <MediaBlock media={item.media} />
          </div>
        ) : item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="max-h-[34rem] w-full object-cover" />
        ) : null}
      </div>

      {isBlog && (
        <Link
          href={`/blog/${item.slug}`}
          className="inline-flex items-center gap-1 px-4 pb-3 text-sm font-semibold text-purple hover:text-purple-700"
        >
          Read the full story <span aria-hidden>→</span>
        </Link>
      )}

      {/* Counts */}
      {(count > 0 || commentCount > 0) && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted">
          {count > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-purple text-white">
                <ThumbsUp className="h-2.5 w-2.5" />
              </span>
              {count}
            </span>
          )}
          {commentCount > 0 && (
            <button
              onClick={() => setShowComments(true)}
              className="ml-auto hover:underline"
            >
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 p-1">
        <button
          onClick={() => doReact()}
          aria-pressed={reacted}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors",
            reacted ? "text-purple" : "text-ink/70 hover:bg-purple-050",
          )}
        >
          <ThumbsUp className={cn("h-5 w-5", reacted && "fill-current")} /> Support
        </button>
        <button
          onClick={() => (signedIn ? setShowComments((s) => !s) : promptSignIn("comment"))}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-purple-050"
        >
          <MessageCircle className="h-5 w-5" /> Comment
        </button>
        <button
          onClick={() => onShare(item.title || item.body.slice(0, 80), shareUrl)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-purple-050"
        >
          <Share2 className="h-5 w-5" /> Share
        </button>
      </div>

      {showComments && !isBlog && (
        <CommentThread
          postId={item.id}
          initial={item.comments}
          signedIn={signedIn}
          isHubAdmin={isHubAdmin}
          onCountChange={setCommentCount}
        />
      )}
    </article>
  );
}
