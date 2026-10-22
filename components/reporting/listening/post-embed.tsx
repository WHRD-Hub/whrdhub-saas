"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlignLeft, Image as ImageIcon } from "lucide-react";
import { postEmbed } from "@/lib/post-embed";
import { cn } from "@/lib/utils";
import { PLATFORM_LABEL } from "./types";

const KEY = "whrd.showPostEmbeds";
const EVENT = "whrd:post-embeds";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const write = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private window: the choice lasts until the page is closed */ }
  window.dispatchEvent(new Event(EVENT));
};

/** Whether this browser has chosen to see posts as they appear on their platform. Remembered, and shared by every post on the page. */
export function useShowEmbeds(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  return [on, write];
}

/** The embed reports how tall its content is, so it can be shown in full instead of scrolling inside a frame. */
function useEmbedHeight(initial: number) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initial);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const host = new URL(e.origin).hostname;
      if (!["instagram.com", "twitter.com", "x.com", "facebook.com"].some((h) => host === h || host.endsWith(`.${h}`))) return;
      let d: unknown = e.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      const o = d as { type?: string; details?: { height?: number }; "twttr.embed"?: { method?: string; params?: { height?: number }[] } } | null;
      const h = o?.type === "MEASURE" ? o.details?.height : o?.["twttr.embed"]?.method === "twttr.private.resize" ? o["twttr.embed"].params?.[0]?.height : undefined;
      if (typeof h === "number" && h > 80) setHeight(Math.min(Math.ceil(h) + 2, 1800));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return { ref, height };
}

function EmbedFrame({ src, title, initial, name }: { src: string; title: string; initial: number; name: string }) {
  const { ref, height } = useEmbedHeight(initial);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <iframe
        ref={ref}
        src={src}
        title={title}
        style={{ height }}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block w-full border-0"
      />
      <p className="border-t border-line bg-paper/60 px-3 py-1.5 text-[11px] text-muted">Loaded from {name}. Switch to Text to stop contacting it.</p>
    </div>
  );
}

/**
 * A captured post, shown one way at a time: as plain text, or as it appears on its
 * own platform with its photos. A switch moves between the two and the choice is
 * remembered on this device, so every post opens the way the person last chose,
 * here and on the case page. The platform is only contacted while the post view is
 * on. Where a post cannot be embedded, only the text is offered.
 */
export function PostView({ permalink, children, className = "" }: { permalink: string | null | undefined; children: React.ReactNode; className?: string }) {
  const [photos, setPhotos] = useShowEmbeds();
  const embed = postEmbed(permalink);
  if (!embed) return <div className={className}>{children}</div>;
  const name = PLATFORM_LABEL[embed.platform];

  const tab = (isPhotos: boolean, label: string, Icon: typeof AlignLeft) => (
    <button
      role="tab"
      aria-selected={photos === isPhotos}
      onClick={() => setPhotos(isPhotos)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
        photos === isPhotos ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className={className}>
      <div role="tablist" aria-label="How to show the post" className="mb-2 flex w-fit gap-0.5 rounded-lg bg-paper p-0.5">
        {tab(false, "Text", AlignLeft)}
        {tab(true, "Post with photos", ImageIcon)}
      </div>
      {photos ? (
        <EmbedFrame src={embed.src} title={`The post on ${name}`} initial={embed.height} name={name} />
      ) : (
        children
      )}
    </div>
  );
}
