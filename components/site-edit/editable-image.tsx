"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Pencil } from "lucide-react";
import { useSiteContent } from "./site-content-provider";
import { EditImageDialog } from "./edit-image-dialog";

/**
 * A photograph on a public page that a Hub super administrator can replace in
 * place. `src` is the page's own photo, shown until someone uploads another.
 *
 * Several of the page's own photos pointed at the old WordPress site, which no
 * longer serves them. A photo that fails to load shows the brand panel instead of
 * a broken-image icon, and in edit mode it says a photo is needed.
 */
export function EditableImage({
  id,
  src,
  alt,
  className = "",
  label,
  wrapperClassName = "",
  fallback,
}: {
  id: string;
  src?: string;
  alt: string;
  /** Classes for the <img>; the placeholder takes the same ones so the layout holds. */
  className?: string;
  /** What the photo should show, for the edit dialog. Defaults to the alt text. */
  label?: string;
  /** Classes for the wrapper, e.g. h-full when the photo fills a fixed frame. */
  wrapperClassName?: string;
  /** Shown to visitors instead of the brand panel when there is no photo (e.g. initials). */
  fallback?: ReactNode;
}) {
  const { valueFor, editing, isPending } = useSiteContent();
  const override = valueFor(id);
  const url = override ?? src ?? "";
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A photo that failed before the page became interactive never fires onError here, so look.
  useEffect(() => {
    const el = img.current;
    setBroken(!!el && el.complete && el.naturalWidth === 0);
  }, [url]);

  const missing = !url || broken;
  const changed = editing && isPending(id);

  return (
    <span className={`${/\b(absolute|fixed)\b/.test(wrapperClassName) ? "" : "relative "}block ${wrapperClassName}`}>
      {missing && fallback && !editing ? (
        fallback
      ) : missing ? (
        <span role="img" aria-label={alt} className={`${className} brand-wash flex flex-col items-center justify-center gap-2 text-purple/60`}>
          <ImageIcon className="w-8 h-8" aria-hidden />
          {editing && <span className="text-xs font-bold uppercase tracking-wider">Photo needed</span>}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={url} alt={alt} className={className} onError={() => setBroken(true)} />
      )}

      {changed && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-magenta px-2.5 py-1 text-xs font-bold text-white shadow">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" /> Draft
        </span>
      )}

      {editing && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-sm font-bold text-purple-700 ring-1 ring-line shadow-lg hover:bg-white"
          >
            <Pencil className="w-3.5 h-3.5" /> {missing ? "Add photo" : "Edit"}
          </button>
          {open && <EditImageDialog id={id} label={label ?? alt} hasOwnPhoto={!!src && !broken && override === undefined} hasOverride={override != null} onClose={() => setOpen(false)} />}
        </>
      )}
    </span>
  );
}
