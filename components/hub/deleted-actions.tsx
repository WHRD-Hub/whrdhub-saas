"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { adminRestore, adminPurge, type ContentKind } from "@/app/actions/lifecycle";
import { adminRestoreReport, adminPurgeReport } from "@/app/actions/lifecycle";
import { adminRestoreAccount, adminPurgeAccount } from "@/app/actions/account";
import { toast } from "@/components/ui/toast";

export type Target =
  | { type: "content"; kind: ContentKind; id: string; label: string }
  | { type: "report"; id: string; label: string }
  | { type: "account"; id: string; label: string };

/**
 * Restore or permanently remove something the Hub is holding.
 *
 * Purging is irreversible, so it asks for the item's name to be typed. That is
 * deliberately more friction than a confirm dialog.
 */
export function DeletedActions({ target }: { target: Target }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  const shortLabel = target.label.slice(0, 40);

  const restore = () => {
    start(async () => {
      const res =
        target.type === "content"
          ? await adminRestore(target.kind, target.id)
          : target.type === "report"
            ? await adminRestoreReport(target.id)
            : await adminRestoreAccount(target.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Restored.");
        router.refresh();
      }
    });
  };

  const purge = () => {
    start(async () => {
      const res =
        target.type === "content"
          ? await adminPurge(target.kind, target.id)
          : target.type === "report"
            ? await adminPurgeReport(target.id)
            : await adminPurgeAccount(target.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Permanently deleted.");
        setConfirming(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
        onClick={restore}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink/80 hover:bg-purple-050 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        Restore
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-surface px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete permanently
        </button>
      ) : (
        <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-1.5">
          <label className="sr-only" htmlFor={`confirm-${target.id}`}>
            Type DELETE to confirm removing {shortLabel}
          </label>
          <input
            id={`confirm-${target.id}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
            className="h-7 w-28 rounded border border-rose-200 bg-surface px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            onClick={purge}
            disabled={pending || typed !== "DELETE"}
            className="inline-flex h-7 items-center gap-1 rounded bg-rose-600 px-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" />} Confirm
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              setTyped("");
            }}
            className="px-1 text-xs font-semibold text-ink/60 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
