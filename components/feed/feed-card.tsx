import Link from "next/link";
import { BadgeCheck, MapPin, BookOpen, Pin } from "lucide-react";
import { NetworkAvatar } from "@/components/feed/network-avatar";
import { Pill } from "@/components/ui/pill";
import { ReactionBar } from "@/components/feed/reaction-bar";
import { MediaBlock } from "@/components/feed/media-block";
import { timeAgo } from "@/lib/utils";
import type { FeedItem } from "@/lib/feed";

export function FeedCard({ item, signedIn = false }: { item: FeedItem; signedIn?: boolean }) {
  const isBlog = item.kind === "blog";
  return (
    <article className="bg-surface px-4 py-4 hover:bg-paper/60 transition-colors">
      <header className="flex items-start gap-3">
        <NetworkAvatar name={item.byline.name} logoUrl={item.byline.logo_url} isHub={item.byline.isHub} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate text-sm font-semibold text-ink">{item.byline.name}</span>
            {item.is_hub && (
              <BadgeCheck className="w-4 h-4 text-purple shrink-0" aria-label="WHRD Hub" />
            )}
          </div>
          <p className="text-xs text-muted truncate">
            {item.byline.person ? `Posted by ${item.byline.person.name}` : (item.byline.county ?? "Women human rights defenders")}
          </p>
          <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
            <span>{timeAgo(item.published_at)}</span>
            {item.county && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {item.county}
              </span>
            )}
          </p>
        </div>
        {item.pinned && (
          <Pill tone="purple" className="shrink-0">
            <Pin className="w-3 h-3" /> Pinned
          </Pill>
        )}
      </header>

      {isBlog ? (
        <div className="mt-3">
          <Pill tone="cyan" className="mb-2 bg-cyan-050 text-cyan-700 border-cyan/30">
            <BookOpen className="w-3 h-3" /> New story
          </Pill>
          <h3 className="font-bold text-ink leading-snug">{item.title}</h3>
          {item.body && <p className="text-sm text-muted mt-1.5 leading-relaxed">{item.body}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">{item.body}</p>
      )}

      {!isBlog && item.media.length > 0 ? (
        <MediaBlock media={item.media} />
      ) : item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt="" className="mt-3 w-full rounded-xl border border-line object-cover max-h-80" />
      ) : null}

      {isBlog && (
        <Link
          href={`/blog/${item.slug}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-purple hover:text-magenta transition-colors"
        >
          Read more <span aria-hidden>→</span>
        </Link>
      )}

      {!isBlog && (
        <ReactionBar
          postId={item.id}
          signedIn={signedIn}
          initialCount={item.reactions}
          initialReacted={item.reactedByMe}
        />
      )}
    </article>
  );
}
