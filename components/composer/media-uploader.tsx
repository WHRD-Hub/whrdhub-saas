"use client";

import { useState, useRef } from "react";
import { ImagePlus, FileText, Video, X, Loader2, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hubFile } from "@/lib/file-url";

export interface MediaItem {
  type: "image" | "video" | "document";
  url: string;
  name: string;
}

/** One file's progress through an upload, so the UI is never blank. */
interface FileStatus {
  name: string;
  state: "uploading" | "done" | "failed";
  detail?: string;
}

/** Windows in particular hands back an empty File.type for some PDFs. */
const TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

function kindOf(file: File): MediaItem["type"] {
  const type = contentTypeOf(file);
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "document";
}

/**
 * Turn Supabase's terse storage errors into something an admin can act on.
 * These are the failures that actually happen in practice: the bucket has not
 * been created yet, or the storage policies reject the write.
 */
function explain(message: string, bucket: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found") || m.includes("does not exist")) {
    return `The "${bucket}" storage bucket does not exist yet. Run supabase/012_publications_bucket.sql in the Supabase SQL editor, then try again.`;
  }
  if (m.includes("row-level security") || m.includes("violates") || m.includes("unauthorized") || m.includes("403")) {
    return `Storage refused the upload to "${bucket}". Your account needs is_hub_admin = true on its profile, and supabase/012_publications_bucket.sql must have been run.`;
  }
  if (m.includes("mime") || m.includes("content type") || m.includes("invalid_mime")) {
    return "That file type is not allowed in this bucket. PDFs, Word and PowerPoint files, and images are accepted.";
  }
  if (m.includes("payload") || m.includes("too large") || m.includes("413")) {
    return "The file is larger than the bucket allows (100 MB).";
  }
  if (m.includes("duplicate") || m.includes("already exists")) {
    return "A file with that name already exists. Rename it and try again.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Could not reach Supabase storage. Check your connection and that NEXT_PUBLIC_SUPABASE_URL is set.";
  }
  return message;
}

/**
 * Drag-and-drop uploader. By default files go to the `media` bucket under the
 * user's own folder (member posts and stories). Pass `bucket="publications"`
 * with a `folder` to store Hub documents instead — see supabase/012_publications_bucket.sql.
 *
 * Every failure path sets a visible message and clears the spinner: an upload
 * that goes wrong must say so, never just sit there.
 */
export function MediaUploader({
  value,
  onChange,
  bucket = "media",
  folder,
  accept = "image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx",
  maxMb = 50,
}: {
  value: MediaItem[];
  onChange: (v: MediaItem[]) => void;
  bucket?: string;
  /** Path prefix inside the bucket. Defaults to the signed-in user's id. */
  folder?: string;
  accept?: string;
  maxMb?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;

    setError(null);
    setUploading(true);
    setStatuses(list.map((f) => ({ name: f.name, state: "uploading" as const })));

    const mark = (name: string, state: FileStatus["state"], detail?: string) =>
      setStatuses((prev) => prev.map((s) => (s.name === name ? { ...s, state, detail } : s)));

    const added: MediaItem[] = [];

    try {
      const supabase = createClient();

      // A signed-out (or unhydrated) session is the quietest failure of all.
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(`Could not confirm your session: ${authErr.message}`);
      const user = auth?.user;
      if (!user) throw new Error("You are signed out. Refresh the page and sign in again.");

      for (const file of list) {
        try {
          if (file.size > maxMb * 1024 * 1024) {
            mark(file.name, "failed", `Larger than ${maxMb} MB.`);
            continue;
          }

          const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const path = `${folder ?? user.id}/${Date.now()}-${safe}`;

          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, file, { upsert: false, contentType: contentTypeOf(file) });

          if (upErr) {
            console.error(`[MediaUploader] upload failed → bucket "${bucket}", path "${path}"`, upErr);
            mark(file.name, "failed", explain(upErr.message, bucket));
            continue;
          }

          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
          if (!pub?.publicUrl) {
            mark(file.name, "failed", "Uploaded, but no public URL came back.");
            continue;
          }

          added.push({ type: kindOf(file), url: pub.publicUrl, name: file.name });
          mark(file.name, "done");
        } catch (e) {
          const detail = e instanceof Error ? e.message : "Unexpected error.";
          console.error(`[MediaUploader] unexpected error uploading ${file.name}`, e);
          mark(file.name, "failed", explain(detail, bucket));
        }
      }

      if (added.length) onChange([...value, ...added]);

      const failed = list.length - added.length;
      if (failed > 0 && added.length === 0) {
        setError(
          list.length === 1
            ? "The file was not uploaded — see the reason below."
            : "None of the files were uploaded — see the reasons below.",
        );
      } else if (failed > 0) {
        setError(`${failed} of ${list.length} files could not be uploaded.`);
      }
    } catch (e) {
      // Anything thrown outside the per-file loop lands here rather than
      // leaving the spinner running with nothing on screen.
      const detail = e instanceof Error ? e.message : "Unexpected error.";
      console.error("[MediaUploader] upload aborted", e);
      setError(explain(detail, bucket));
      setStatuses((prev) => prev.map((s) => (s.state === "uploading" ? { ...s, state: "failed" as const } : s)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${dragging ? "border-purple bg-purple-050" : "border-line hover:border-purple/40 hover:bg-purple-050/40"}`}
      >
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
        {uploading ? (
          <p className="text-sm text-muted flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</p>
        ) : (
          <div className="text-sm text-muted">
            <UploadCloud className="w-6 h-6 mx-auto text-purple mb-1" />
            <p className="font-semibold text-ink">Drag &amp; drop, or click to add media</p>
            <p className="text-xs flex items-center justify-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Images</span>
              <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video</span>
              <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Docs</span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 font-semibold">{error}</p>
        </div>
      )}

      {/* Per-file outcome, so something always changes on screen. */}
      {statuses.length > 0 && (
        <ul className="mt-2 space-y-1">
          {statuses.map((s) => (
            <li key={s.name} className="text-xs flex items-start gap-1.5">
              {s.state === "uploading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted shrink-0 mt-0.5" />}
              {s.state === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
              {s.state === "failed" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />}
              <span className={s.state === "failed" ? "text-rose-700" : "text-muted"}>
                <span className="font-semibold">{s.name}</span>
                {s.detail ? ` — ${s.detail}` : s.state === "done" ? " — uploaded" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((m, i) => (
            <div key={i} className="relative rounded-lg border border-line overflow-hidden bg-paper group">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hubFile(m.url)} alt={m.name} className="w-full h-24 object-cover" />
              ) : m.type === "video" ? (
                <div className="w-full h-24 flex items-center justify-center bg-black text-white"><Video className="w-6 h-6" /></div>
              ) : (
                <div className="w-full h-24 flex flex-col items-center justify-center text-muted p-2"><FileText className="w-6 h-6" /><span className="text-[10px] truncate max-w-full mt-1">{m.name}</span></div>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, j) => j !== i)); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
