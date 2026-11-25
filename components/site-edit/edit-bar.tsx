"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PencilLine } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useSiteContent } from "./site-content-provider";

/**
 * Shown only to a Hub super administrator on the public pages. Off: a small
 * "Edit this page" button. On: a bar along the bottom with the number of
 * unpublished changes, Publish, Discard and Done.
 */
export function EditBar() {
  const router = useRouter();
  const { canEdit, editing, pending, setEditing, publish, discard } = useSiteContent();
  const [busy, setBusy] = useState<null | "toggle" | "publish" | "discard">(null);
  if (!canEdit) return null;

  const run = async (what: "toggle" | "publish" | "discard", fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    setBusy(what);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return toast.error(res.error ?? "Something went wrong.");
    if (done) toast.success(done);
    router.refresh();
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => run("toggle", () => setEditing(true))}
        disabled={busy !== null}
        className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full bg-purple px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple/30 hover:bg-purple-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
        Edit this page
        {pending.length > 0 && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">{pending.length} unpublished</span>}
      </button>
    );
  }

  const count = pending.length;
  const changes = `${count} unpublished change${count === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-purple-700 bg-purple text-white" role="region" aria-label="Edit mode">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6">
        <span className="inline-flex items-center gap-2 font-bold">
          <span aria-hidden className={`h-2 w-2 rounded-full ${count ? "bg-magenta-050 animate-pulse" : "bg-white/60"}`} />
          Edit mode
        </span>
        <span className="text-white/85">
          {count ? changes : <span className="hidden sm:inline">Click any outlined text to change it; use Edit on a photo to replace it.</span>}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {count > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("discard", discard, "Unpublished changes discarded")}
              className="rounded-full border border-white/40 px-3.5 py-1.5 font-bold hover:bg-white/10 disabled:opacity-50"
            >
              {busy === "discard" ? "Discarding…" : "Discard"}
            </button>
          )}
          <button
            type="button"
            disabled={count === 0 || busy !== null}
            onClick={() => run("publish", publish, "Published. Everyone now sees your changes.")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-bold text-purple-700 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy === "publish" ? "Publishing…" : count ? `Publish ${count}` : "Publish"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("toggle", () => setEditing(false))}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-white/90 hover:bg-white/10"
          >
            <Check className="h-4 w-4" /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
