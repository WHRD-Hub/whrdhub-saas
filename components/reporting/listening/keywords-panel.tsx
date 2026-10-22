"use client";

import { useState } from "react";
import { EyeOff, Loader2, Plus, ShieldAlert, X } from "lucide-react";
import { addKeyword, removeKeyword, toggleKeyword, seedPoliticalKeywords } from "@/app/actions/listening";
import { cn } from "@/lib/utils";
import type { Keyword, Run } from "./types";

const GROUPS = [
  { id: "high", title: "High priority", hint: "Surface first", dot: "bg-rose-500" },
  { id: "medium", title: "Medium", hint: "", dot: "bg-amber-500" },
  { id: "low", title: "Low", hint: "", dot: "bg-slate-300" },
] as const;

/** The words that make a post worth looking at, grouped by how urgent they are. */
export function KeywordsPanel({ keywords, run, busy }: { keywords: Keyword[]; run: Run; busy: string | null }) {
  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState("high");

  return (
    <section className="card-premium p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Words we listen for</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">A post containing any of these is captured. Mute a word to stop it matching without losing it.</p>
        </div>
        <button
          onClick={() => run("seed", seedPoliticalKeywords)}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50"
        >
          {busy === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5 text-magenta" />}
          Add political-harassment words
        </button>
      </div>

      <form
        className="mt-5 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          run("add", async () => { const r = await addKeyword(word, severity); if (!r?.error) setWord(""); return r; });
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Add a word or phrase" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30 sm:max-w-xs" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Priority" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <button type="submit" disabled={busy !== null || !word.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-purple px-4 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </form>

      {keywords.length === 0 && <p className="mt-6 text-sm text-muted">No words yet. Add one above, or add the political-harassment set.</p>}

      <div className="mt-6 space-y-5">
        {GROUPS.map((g) => {
          const items = keywords.filter((k) => (k.severity === g.id) || (g.id === "low" && !["high", "medium"].includes(k.severity)));
          if (items.length === 0) return null;
          return (
            <div key={g.id}>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                <span className={cn("h-2 w-2 rounded-full", g.dot)} /> {g.title} <span className="font-normal">· {items.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((k) => (
                  <span key={k.id} className={cn("group inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-[13px] font-medium", k.active ? "border-line bg-surface text-ink" : "border-line bg-paper text-muted line-through")}>
                    {k.word}
                    <button onClick={() => run(`t-${k.id}`, () => toggleKeyword(k.id, !k.active))} disabled={busy !== null} title={k.active ? "Mute" : "Turn back on"} aria-label={k.active ? `Mute ${k.word}` : `Turn ${k.word} back on`} className="rounded-full p-1 text-muted/70 hover:bg-paper hover:text-ink">
                      <EyeOff className="h-3 w-3" />
                    </button>
                    <button onClick={() => run(`d-${k.id}`, () => removeKeyword(k.id))} disabled={busy !== null} title="Remove" aria-label={`Remove ${k.word}`} className="rounded-full p-1 text-muted/70 hover:bg-rose-50 hover:text-rose-600">
                      {busy === `d-${k.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
