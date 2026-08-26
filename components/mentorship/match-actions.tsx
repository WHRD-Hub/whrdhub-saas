"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Sparkles } from "lucide-react";
import { respondToMatch, recomputeAllMatches } from "@/app/actions/mentorship";

export function MatchActions({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (decision: "accepted" | "declined", tag: string) => {
    setBusy(tag);
    await respondToMatch(matchId, decision);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => respond("accepted", "a")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg bg-purple text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {busy === "a" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
      </button>
      <button
        onClick={() => respond("declined", "d")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-rose-50 disabled:opacity-50"
      >
        {busy === "d" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Not now
      </button>
    </div>
  );
}

export function RunMatching() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const res = await recomputeAllMatches();
    setBusy(false);
    setMsg(res?.error ? res.error : `Recomputed — ${res?.count ?? 0} suggestions.`);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-purple text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Recompute suggestions
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
