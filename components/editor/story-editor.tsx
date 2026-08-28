"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Send, FileEdit, Eye, Pencil, Clock, CheckCircle2, XCircle, Type, ArrowLeft } from "lucide-react";
import { Input, Label } from "@/components/ui/field";
import { RichText, readingStats } from "@/components/editor/rich-text";
import { MediaUploader, type MediaItem } from "@/components/composer/media-uploader";
import { cn } from "@/lib/utils";
import { updateOwnBlog } from "@/app/actions/content";
import { hubFile, hubFileHtml } from "@/lib/file-url";

const STATE = {
  draft: { label: "Draft", icon: FileEdit, cls: "border-slate-200 bg-slate-50 text-slate-700", note: "Only you can see this. Save as you go, then submit when it's ready." },
  rejected: { label: "Declined", icon: XCircle, cls: "border-rose-200 bg-rose-50 text-rose-700", note: "The Hub did not approve this yet. Make changes and submit it again." },
  pending: { label: "In review", icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-800", note: "The Hub is reviewing this. You can edit it again once it's published or declined." },
  approved: { label: "Published", icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800", note: "This story is live on the feed." },
} as const;

export function StoryEditor({
  id,
  initial,
}: {
  id: string;
  initial: { title: string; excerpt: string; body: string; cover: string | null; status: string; reviewNotes: string | null };
}) {
  const router = useRouter();
  const editable = initial.status === "draft" || initial.status === "rejected";
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [body, setBody] = useState(initial.body);
  const [cover, setCover] = useState<MediaItem[]>(initial.cover ? [{ type: "image", url: initial.cover, name: "cover" }] : []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = STATE[initial.status as keyof typeof STATE] ?? STATE.draft;
  const StateIcon = state.icon;
  const stats = readingStats(body);

  const run = async (submit: boolean) => {
    setBusy(submit ? "submit" : "draft"); setError(null); setMsg(null);
    const res = await updateOwnBlog(id, { title, excerpt, body, cover_image_url: cover[0]?.url ?? null }, { submit });
    setBusy(null);
    if (res?.error) { setError(res.error); return; }
    if (submit) { router.push("/profile"); router.refresh(); }
    else { setMsg("Draft saved."); router.refresh(); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" /> My activity</Link>

      <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", state.cls)}>
        <StateIcon className="w-5 h-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{state.label}</p>
          <p className="text-xs opacity-90">{state.note}</p>
          {initial.status === "rejected" && initial.reviewNotes && (
            <p className="text-xs mt-1"><span className="font-semibold">Hub note:</span> {initial.reviewNotes}</p>
          )}
        </div>
      </div>

      {!editable ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <h1 className="text-2xl font-black text-ink">{title || "Untitled story"}</h1>
          {excerpt && <p className="text-muted mt-1">{excerpt}</p>}
          <div className="blog-content mt-4" dangerouslySetInnerHTML={{ __html: hubFileHtml(body) }} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl border border-line bg-paper p-1 w-fit">
              {(["edit", "preview"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold capitalize transition-colors", view === v ? "bg-purple text-white" : "text-ink/70 hover:bg-purple-050")}>
                  {v === "edit" ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {v}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted inline-flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> {stats.words} words · {stats.minutes} min read</span>
          </div>

          {view === "edit" ? (
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title" /></div>
              <div><Label>Summary <span className="text-muted font-normal">(shown in the feed)</span></Label><Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One line that draws readers in" /></div>
              <div><Label>Cover image</Label><MediaUploader value={cover} onChange={(v) => setCover(v.slice(-1))} /></div>
              <div><Label>Your story</Label><RichText value={body} onChange={setBody} /></div>
            </div>
          ) : (
            <article className="rounded-xl border border-line bg-surface p-6">
              {cover[0]?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hubFile(cover[0].url)} alt="" className="w-full max-h-72 object-cover rounded-xl border border-line mb-4" />
              )}
              <h1 className="text-2xl font-black text-ink">{title || "Untitled story"}</h1>
              {excerpt && <p className="text-muted mt-1">{excerpt}</p>}
              <div className="blog-content mt-4" dangerouslySetInnerHTML={{ __html: hubFileHtml(body) || "<p>Nothing to preview yet.</p>" }} />
            </article>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {msg && <p className="text-sm text-emerald-700 font-semibold">{msg}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={() => run(false)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 h-11 text-sm font-bold text-ink hover:bg-purple-050 disabled:opacity-50">
              {busy === "draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />} Save draft
            </button>
            <button onClick={() => run(true)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600 disabled:opacity-50">
              {busy === "submit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit for review
            </button>
          </div>
        </>
      )}
    </div>
  );
}
