"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { backfillResourceFiles } from "@/app/actions/resources";

interface Result {
  moved: number;
  alreadyStored: number;
  problems: string[];
}

/**
 * Copies any document or cover still hosted on an outside server into the
 * Hub's publications bucket. Safe to press more than once — files already in
 * storage are skipped.
 */
export function StorageBackfill({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = (await backfillResourceFiles()) as {
      error?: string;
      moved?: number;
      alreadyStored?: number;
      problems?: string[];
    };
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult({
      moved: res.moved ?? 0,
      alreadyStored: res.alreadyStored ?? 0,
      problems: res.problems ?? [],
    });
    router.refresh();
  };

  if (pending === 0 && !result && !error) return null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-purple-050 text-purple grid place-items-center shrink-0">
          <CloudUpload className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {pending > 0
              ? `${pending} file${pending === 1 ? "" : "s"} still hosted elsewhere`
              : "All files are in the Hub's storage"}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Copy them into the Hub&apos;s own storage so the downloads keep working no matter what
            happens to the other site.
          </p>
        </div>
        {pending > 0 && (
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 h-10 text-sm font-bold text-ink hover:bg-purple-050 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
            {busy ? "Copying…" : "Copy into storage"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {result.moved} moved into storage · {result.alreadyStored} already there
          </p>
          {result.problems.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Could not copy these
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-800 list-disc pl-5">
                {result.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
