"use client";

import { Hash, Loader2 } from "lucide-react";
import { acceptTagSuggestion, declineTagSuggestion } from "@/app/actions/listening";
import type { TagSuggestion } from "@/lib/listening-tags";
import type { Run } from "./types";

/** Hashtags that keep appearing in captures. Nothing is added until someone says yes. */
export function TagSuggestions({ tags, run, busy }: { tags: TagSuggestion[]; run: Run; busy: string | null }) {
  if (!tags.length) return null;
  return (
    <div className="space-y-2">
      {tags.map((t) => {
        const working = busy === `tag-${t.tag}`;
        const add = (platforms: ("instagram" | "x")[]) => run(`tag-${t.tag}`, () => acceptTagSuggestion(t.tag, platforms));
        return (
          <div key={t.tag} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-purple/20 bg-purple-050/70 px-3 py-2">
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <Hash className="h-4 w-4 shrink-0 text-purple" />
              <span><span className="font-semibold">#{t.tag}</span> keeps appearing: {t.posts} captures from {t.accounts} accounts in two weeks. Listen to it?</span>
            </p>
            <span className="flex items-center gap-2">
              {working && <Loader2 className="h-4 w-4 animate-spin text-purple" />}
              <button onClick={() => add(["instagram", "x"])} disabled={busy !== null} className="rounded-lg bg-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50">Add on both</button>
              <button onClick={() => add(["instagram"])} disabled={busy !== null} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50">Instagram</button>
              <button onClick={() => add(["x"])} disabled={busy !== null} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50">X</button>
              <button onClick={() => run(`tag-${t.tag}`, () => declineTagSuggestion(t.tag))} disabled={busy !== null} className="px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-50">No thanks</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
