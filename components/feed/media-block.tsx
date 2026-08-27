import { FileText, Download } from "lucide-react";
import type { MediaItem } from "@/lib/feed";
import { hubFile } from "@/lib/file-url";

/** Returns the YouTube video id if the URL is a YouTube link, else null. */
function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

/** Renders a post's mixed media: images (grid), videos (player), documents (link). */
export function MediaBlock({ media }: { media: MediaItem[] }) {
  if (!media || media.length === 0) return null;
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const docs = media.filter((m) => m.type === "document");

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={hubFile(m.url)} alt={m.name} className={`w-full object-cover rounded-xl border border-line ${images.length === 1 ? "max-h-[26rem]" : "h-40"}`} />
          ))}
        </div>
      )}

      {videos.map((m, i) => {
        const yt = youTubeId(m.url);
        return yt ? (
          <div key={i} className="relative w-full overflow-hidden rounded-xl border border-line bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${yt}`}
              title={m.name || "YouTube video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 w-full h-full"
            />
          </div>
        ) : (
          <video key={i} src={hubFile(m.url)} controls className="w-full rounded-xl border border-line bg-black max-h-[26rem]" preload="metadata">
            Your browser does not support video.
          </video>
        );
      })}

      {docs.map((m, i) => (
        <a key={i} href={hubFile(m.url)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3 hover:bg-purple-050 transition-colors">
          <span className="w-10 h-10 rounded-lg bg-purple-050 text-purple grid place-items-center shrink-0"><FileText className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink truncate">{m.name}</span><span className="text-xs text-muted">Document</span></span>
          <Download className="w-4 h-4 text-muted shrink-0" />
        </a>
      ))}
    </div>
  );
}
