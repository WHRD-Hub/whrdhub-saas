"use client";

import { useState, useRef } from "react";
import { ImagePlus, FileText, Video, X, Loader2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface MediaItem {
  type: "image" | "video" | "document";
  url: string;
  name: string;
}

function kindOf(file: File): MediaItem["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

/**
 * Drag-and-drop uploader. By default files go to the `media` bucket under the
 * user's own folder (member posts and stories). Pass `bucket="publications"`
 * with a `folder` to store Hub documents instead — see supabase/012_publications_bucket.sql.
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
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in to upload."); setUploading(false); return; }

    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      if (file.size > maxMb * 1024 * 1024) { setError(`${file.name} is larger than ${maxMb} MB.`); continue; }
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${folder ?? user.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (upErr) { setError(upErr.message); continue; }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      added.push({ type: kindOf(file), url: pub.publicUrl, name: file.name });
    }
    onChange([...value, ...added]);
    setUploading(false);
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
            <p className="font-semibold text-ink">Drag & drop, or click to add media</p>
            <p className="text-xs flex items-center justify-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Images</span>
              <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video</span>
              <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Docs</span>
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((m, i) => (
            <div key={i} className="relative rounded-lg border border-line overflow-hidden bg-paper group">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="w-full h-24 object-cover" />
              ) : m.type === "video" ? (
                <div className="w-full h-24 flex items-center justify-center bg-black text-white"><Video className="w-6 h-6" /></div>
              ) : (
                <div className="w-full h-24 flex flex-col items-center justify-center text-muted p-2"><FileText className="w-6 h-6" /><span className="text-[10px] truncate max-w-full mt-1">{m.name}</span></div>
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
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
