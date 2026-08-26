"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Youtube, Pin, Share2, Image as ImageIcon, Video, Smile, PenLine } from "lucide-react";
import { Avatar } from "@/components/ui/field";
import { PostCard } from "@/components/feed/post-card";
import { FeedRail } from "@/components/feed/feed-rail";
import { PendingPosts } from "@/components/feed/pending-posts";
import type { FeedItem } from "@/lib/feed";

interface CountyChip {
  name: string;
  slug: string;
}

function useShare() {
  const [toast, setToast] = useState<string | null>(null);
  const share = useCallback(async (title: string, url: string) => {
    const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "WHRD Hub", text: title, url: absolute });
        return;
      }
    } catch {
      return; // the person cancelled
    }
    try {
      await navigator.clipboard.writeText(absolute);
      setToast("Link copied");
      setTimeout(() => setToast(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, []);
  return { share, toast };
}

/** The "What's on your mind" box. Clicking anywhere in it opens the composer. */
function ComposerCard({
  userName,
  avatarUrl,
  signedIn,
  canPost,
  onOpen,
}: {
  userName?: string | null;
  avatarUrl?: string | null;
  signedIn: boolean;
  canPost: boolean;
  onOpen: () => void;
}) {
  const firstName = (userName || "").trim().split(/\s+/)[0];

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,21,34,0.06)]">
        <p className="text-sm leading-relaxed text-ink">
          You can read the feed and support posts without an account.{" "}
          <Link href="/login" className="font-bold text-purple hover:underline">
            Sign in
          </Link>{" "}
          to comment, and join a county network to post.
        </p>
      </div>
    );
  }

  // Signed in but not yet a member of any network.
  if (!canPost) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,21,34,0.06)]">
        <p className="text-sm font-semibold text-ink">Posting is for network members</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Ask to join a county network and you can share updates and publish stories.
          You can support and comment on posts in the meantime.
        </p>
        <Link
          href="/organizations"
          className="mt-3 inline-flex h-10 items-center rounded-xl bg-purple px-4 text-sm font-bold text-white hover:bg-purple-600"
        >
          Find a network
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(28,21,34,0.06)]">
      <div className="flex items-center gap-2">
        <Avatar name={userName ?? "You"} src={avatarUrl} size={40} />
        <button
          onClick={onOpen}
          className="h-10 flex-1 rounded-full bg-paper px-4 text-left text-[15px] text-muted transition-colors hover:bg-purple-050"
        >
          {firstName ? `What's on your mind, ${firstName}?` : "What's on your mind?"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
        {[
          { icon: Video, label: "Video", tint: "text-magenta-700" },
          { icon: ImageIcon, label: "Photo", tint: "text-emerald-600" },
          { icon: PenLine, label: "Write a story", tint: "text-purple" },
          { icon: Smile, label: "Feeling", tint: "text-amber-500" },
        ].map(({ icon: Icon, label, tint }) => (
          <button
            key={label}
            onClick={onOpen}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-semibold text-ink/70 transition-colors hover:bg-purple-050"
          >
            <Icon className={`h-5 w-5 ${tint}`} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VideoCard({
  id,
  pinned,
  onShare,
}: {
  id: string;
  pinned?: boolean;
  onShare: (t: string, u: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.06)]">
      <div className="flex items-center gap-2.5 p-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FF0000]/10 text-[#FF0000]">
          <Youtube className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">The Hub Kenya</p>
          <p className="text-xs text-muted">From our YouTube channel</p>
        </div>
        {pinned && (
          <span className="inline-flex items-center gap-1 rounded-full border border-magenta/20 bg-magenta-050 px-2 py-0.5 text-xs font-semibold text-magenta-700">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
      </div>
      <div className="aspect-video w-full bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="The Hub Kenya"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center p-1">
        <a
          href={`https://youtu.be/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink/70 hover:bg-purple-050"
        >
          <Youtube className="h-5 w-5" /> Watch
        </a>
        <button
          onClick={() => onShare("Watch on The Hub Kenya", `https://youtu.be/${id}`)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink/70 hover:bg-purple-050"
        >
          <Share2 className="h-5 w-5" /> Share
        </button>
      </div>
    </article>
  );
}

type Stream =
  | { type: "post"; key: string; item: FeedItem }
  | { type: "video"; key: string; id: string; pinned?: boolean };

/**
 * The community feed: a navigation rail, the stream, and a context column.
 * The rails collapse away below large screens, leaving the stream full width.
 */
export function FeedView({
  feed,
  videos,
  signedIn,
  isHubAdmin = false,
  canPost = false,
  userName,
  avatarUrl,
  counties = [],
  onCompose,
}: {
  feed: FeedItem[];
  videos: string[];
  signedIn: boolean;
  isHubAdmin?: boolean;
  canPost?: boolean;
  userName?: string | null;
  avatarUrl?: string | null;
  counties?: CountyChip[];
  onCompose: () => void;
}) {
  const { share, toast } = useShare();

  // Interleave the Hub's videos so the stream is not a wall of text.
  const rest = videos.slice(1);
  const stream: Stream[] = videos.length
    ? [{ type: "video", key: `v-${videos[0]}`, id: videos[0], pinned: true }]
    : [];
  let vi = 0;
  feed.forEach((item, i) => {
    stream.push({ type: "post", key: `${item.kind}-${item.id}`, item });
    if (i % 3 === 2 && vi < rest.length) {
      stream.push({ type: "video", key: `v-${rest[vi]}`, id: rest[vi] });
      vi += 1;
    }
  });
  while (vi < rest.length) {
    stream.push({ type: "video", key: `v-${rest[vi]}`, id: rest[vi] });
    vi += 1;
  }

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6 px-3 py-4 sm:px-4">
      {/* Left rail */}
      <aside className="hidden w-[19rem] shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 feed-scroll">
          <FeedRail userName={userName} avatarUrl={avatarUrl} signedIn={signedIn} />
        </div>
      </aside>

      {/* Stream */}
      <main className="mx-auto w-full max-w-[42rem] min-w-0 space-y-4">
        <ComposerCard
          userName={userName}
          avatarUrl={avatarUrl}
          signedIn={signedIn}
          canPost={canPost}
          onOpen={onCompose}
        />

        {signedIn && <PendingPosts userName={userName} avatarUrl={avatarUrl} />}

        {stream.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted">
              Be the first to share something with the movement.
            </p>
          </div>
        )}

        {stream.map((s) =>
          s.type === "post" ? (
            <PostCard
              key={s.key}
              item={s.item}
              signedIn={signedIn}
              isHubAdmin={isHubAdmin}
              onShare={share}
            />
          ) : (
            <VideoCard key={s.key} id={s.id} pinned={s.pinned} onShare={share} />
          ),
        )}

        <div className="pb-10 text-center">
          <Link href="/blog" className="text-sm font-semibold text-purple hover:text-purple-700">
            Browse all stories →
          </Link>
        </div>
      </main>

      {/* Right rail */}
      <aside className="hidden w-[19rem] shrink-0 xl:block">
        <div className="sticky top-20 space-y-4">
          {counties.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[15px] font-bold text-muted">County networks</h2>
              <ul className="space-y-0.5">
                {counties.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/counties/${c.slug}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-ink transition-colors hover:bg-purple-050"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-purple-050 text-xs font-bold text-purple">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold text-ink">Need support?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Reporting is confidential and works without an account. In an emergency call{" "}
              <a href="tel:1195" className="font-bold text-magenta-700">
                1195
              </a>
              .
            </p>
            <Link
              href="/report"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-magenta px-4 text-sm font-bold text-white transition-[filter] hover:brightness-95"
            >
              Report abuse
            </Link>
          </section>
        </div>
      </aside>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
