"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, BookOpen, Send, Youtube, Pin, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createPost, createBlog } from "@/app/actions/content";
import { MediaUploader, type MediaItem } from "@/components/composer/media-uploader";
import { RichText } from "@/components/editor/rich-text";
import { enqueue, requestBackgroundSync } from "@/lib/offline/outbox";
import { useOnline } from "@/lib/use-online";

export function Composer({ isHub = false, onDone }: { isHub?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"post" | "blog">("post");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // post
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [youtube, setYoutube] = useState("");
  const [pin, setPin] = useState(false);
  // blog
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [blogBody, setBlogBody] = useState("");
  const [cover, setCover] = useState<MediaItem[]>([]);

  const [doneKind, setDoneKind] = useState<"published" | "review" | "draft" | "queued">("review");
  const online = useOnline();

  const clear = () => {
    setBody(""); setMedia([]); setYoutube(""); setPin(false);
    setTitle(""); setExcerpt(""); setBlogBody(""); setCover([]);
  };

  const submit = async (asDraft = false) => {
    setLoading(true);
    setError(null);

    // Offline: keep the post on the device and send it when the connection is
    // back, the way a chat app does. Stories are long-form and usually have a
    // cover image, so they are not queued — the draft is the right home for a
    // story you cannot submit yet.
    if (!online && tab === "post") {
      try {
        await enqueue("post", { body, pinned: isHub ? pin : undefined });
        await requestBackgroundSync();
        setLoading(false);
        setDoneKind("queued");
        setDone(true);
        clear();
        onDone?.();
        return;
      } catch {
        setLoading(false);
        setError("This device could not save your post offline. Please try again when you have a connection.");
        return;
      }
    }

    const res =
      tab === "post"
        ? await createPost(body, media, isHub ? { pinned: pin, youtubeUrl: youtube || undefined } : {})
        : await createBlog({ title, excerpt, body: blogBody, cover_image_url: cover[0]?.url }, { asDraft });
    setLoading(false);
    if (res?.error) { setError(res.error); return; }
    setDoneKind(isHub ? "published" : asDraft ? "draft" : "review");
    setDone(true);
    clear();
    router.refresh();
    onDone?.();
  };

  return (
    <div className="bg-surface rounded-2xl border border-line p-5">
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setTab("post"); setDone(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold", tab === "post" ? "bg-purple text-white" : "text-muted hover:bg-purple-050")}>
          <PenLine className="w-4 h-4" /> Post
        </button>
        <button onClick={() => { setTab("blog"); setDone(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold", tab === "blog" ? "bg-purple text-white" : "text-muted hover:bg-purple-050")}>
          <BookOpen className="w-4 h-4" /> Write a story
        </button>
      </div>

      {done ? (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            doneKind === "queued"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {doneKind === "published"
            ? "Published. It is live on the feed now."
            : doneKind === "draft"
            ? "Saved as a draft. Find it under Profile → My Activity to keep editing or submit it."
            : doneKind === "queued"
            ? "Saved on this device. It will send itself as soon as you are back online — you can close the app."
            : "Sent to the Hub for review. You will see it on the feed once it is approved."}
        </div>
      ) : tab === "post" ? (
        <div className="space-y-3">
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Share an update from your work or community..."
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple/30 resize-y" />
          {online ? (
            <MediaUploader value={media} onChange={setMedia} />
          ) : (
            <p className="rounded-xl border border-dashed border-line bg-paper p-3 text-xs text-muted">
              You are offline. Photos and files need a connection, so this post will go out
              as text. It is saved here and sends itself when you reconnect.
            </p>
          )}

          {isHub && (
            <div className="rounded-xl border border-purple-050 bg-purple-050/40 p-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-700">Hub tools</p>
              <div>
                <Label className="flex items-center gap-1.5"><Youtube className="w-4 h-4 text-magenta-700" /> Share a YouTube video</Label>
                <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="Paste a YouTube link (optional)" />
                <p className="text-xs text-muted mt-1">Your text above appears with the video.</p>
              </div>
              <button type="button" onClick={() => setPin((p) => !p)} aria-pressed={pin}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold w-full", pin ? "border-purple bg-purple-050 text-purple-700" : "border-line bg-surface text-ink hover:bg-purple-050")}>
                <Pin className="w-4 h-4" /> Pin to top of the feed
                <span className={cn("ml-auto text-xs font-bold", pin ? "text-purple-700" : "text-muted")}>{pin ? "On" : "Off"}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The headline of your story" /></div>
          <div><Label>Short summary <span className="text-muted font-normal">(optional)</span></Label><Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One line that appears in the feed" /></div>
          <div>
            <Label>Cover image <span className="text-muted font-normal">(optional)</span></Label>
            <MediaUploader value={cover} onChange={(v) => setCover(v.slice(-1))} />
          </div>
          <div><Label>Your story</Label><RichText value={blogBody} onChange={setBlogBody} placeholder="Write freely. Use the toolbar for headings, quotes, lists, links, and images." /></div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {!done && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {!online && tab === "post"
              ? "Offline. Your post is saved here and sends itself when you reconnect."
              : isHub
                ? "Posting as the Hub. Goes live immediately."
                : tab === "blog"
                  ? "Save a draft, or submit for the Hub to review."
                  : "Reviewed by the Hub before it goes public."}
          </p>
          <div className="flex items-center gap-2">
            {!isHub && tab === "blog" && (
              <Button variant="outline" onClick={() => submit(true)} disabled={loading}>
                <FileEdit className="w-4 h-4" /> Save draft
              </Button>
            )}
            <Button onClick={() => submit(false)} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />{" "}
                  {!online && tab === "post"
                    ? "Save and send later"
                    : isHub
                      ? "Publish"
                      : tab === "blog"
                        ? "Submit for review"
                        : "Submit"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
