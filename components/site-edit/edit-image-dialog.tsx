"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listSiteImages } from "@/app/actions/site-content";
import { toast } from "@/components/ui/toast";
import { useSiteContent } from "./site-content-provider";

/** Photos wider than this are scaled down before upload; a page never shows them larger. */
const MAX_EDGE = 2400;
/** Below this, and already a reasonable size, a photo is uploaded exactly as chosen. */
const KEEP_UNDER = 1.5 * 1024 * 1024;

/**
 * Replace one photograph on a public page: upload a new one or reuse one uploaded
 * before. The choice is saved as a draft; visitors see it once the editor presses
 * Publish in the editing bar.
 */
export function EditImageDialog({
  id,
  label,
  hasOwnPhoto,
  hasOverride,
  onClose,
}: {
  id: string;
  label: string;
  hasOwnPhoto: boolean;
  hasOverride: boolean;
  onClose: () => void;
}) {
  const { save } = useSiteContent();
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [library, setLibrary] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, busy]);

  // Release the preview's memory when the dialog closes.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  useEffect(() => {
    if (tab !== "library" || library !== null) return;
    listSiteImages().then((r) => (r.ok ? setLibrary(r.images) : (setError(r.error), setLibrary([]))));
  }, [tab, library]);

  const choose = async (value: string | null, message: string) => {
    setBusy(true);
    setError(null);
    const res = await save(id, "image", value);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(message);
    onClose();
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = await prepare(file);
      const base = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "photo";
      const ext = body.type === "image/png" ? "png" : body.type === "image/webp" ? "webp" : "jpg";
      const path = `site/${Date.now()}-${base}.${ext}`;
      const storage = createClient().storage.from("publications");
      const { error: upErr } = await storage.upload(path, body, { upsert: false, contentType: body.type });
      if (upErr) throw new Error(upErr.message);
      const url = storage.getPublicUrl(path).data.publicUrl;
      setBusy(false);
      await choose(url, "Photo saved as a draft. Press Publish to make it live.");
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "The upload failed. Please try again.");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit photo: ${label}`}
        tabIndex={-1}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink">Edit photo</h2>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-purple-050">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 rounded-lg bg-purple-050 px-3 py-2 text-xs leading-relaxed text-ink/70">
          Changes are saved as a draft. Nothing goes live until you press <span className="font-bold text-purple-700">Publish</span> in the editing bar.
        </p>

        <div className="mt-4 flex gap-1 rounded-full bg-purple-050 p-1 text-sm">
          {(["upload", "library"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`flex-1 rounded-full px-4 py-2 font-bold transition-colors ${tab === t ? "bg-surface text-purple-700 shadow-sm" : "text-ink/60 hover:text-ink"}`}
            >
              {t === "upload" ? "Upload new" : "Choose existing"}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {tab === "upload" ? (
          <div className="mt-5">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper px-4 py-8 text-center transition-colors hover:border-purple">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Selected photo" className="max-h-52 w-auto rounded-lg object-contain" />
              ) : (
                <>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-purple-050 text-purple"><Upload className="h-5 w-5" /></span>
                  <span className="mt-3 text-sm font-bold text-ink">Choose a photo to upload</span>
                  <span className="mt-1 text-xs text-muted">JPG, PNG or WebP. Large photos are resized for the web.</span>
                </>
              )}
            </label>
            <button
              type="button"
              onClick={upload}
              disabled={!file || busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple px-5 py-3 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Uploading…" : "Use this photo"}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            {library === null ? (
              <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading photos…</p>
            ) : library.length === 0 ? (
              <p className="text-sm text-muted">No photos have been uploaded through edit mode yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {library.map((u) => (
                  <button key={u} type="button" disabled={busy} onClick={() => choose(u, "Photo saved as a draft. Press Publish to make it live.")}
                    className="overflow-hidden rounded-lg border border-line hover:ring-2 hover:ring-purple">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasOverride && (
          <button
            type="button"
            disabled={busy}
            onClick={() => choose(null, hasOwnPhoto ? "Put back the original photo" : "Photo removed from the draft")}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-purple-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Use the page&apos;s original photo
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Resize a large photo in the browser so the site never serves a camera original. */
async function prepare(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE && file.size <= KEEP_UNDER) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; // a JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
