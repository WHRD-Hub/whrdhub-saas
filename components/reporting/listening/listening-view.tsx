"use client";

import { useState } from "react";
import {
  RadioTower, RefreshCw, Loader2, Plus, X, Circle, Plug, ExternalLink,
  Check, EyeOff, Search,
} from "lucide-react";
import { pollMeta, addKeyword, removeKeyword, toggleKeyword, setResultStatus } from "@/app/actions/listening";
import { useRouter } from "next/navigation";

export interface Keyword { id: string; word: string; severity: string; active: boolean }
export interface Result {
  id: string; source: string; permalink: string | null; author: string | null;
  content: string; matched_keywords: string[]; severity: string; status: string; captured_at: string;
}

const SEV: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_TABS = ["new", "reviewing", "actioned", "dismissed"] as const;

export function ListeningView({ connected, keywords, results }: { connected: boolean; keywords: Keyword[]; results: Result[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newWord, setNewWord] = useState("");
  const [newSev, setNewSev] = useState("high");

  const run = async (tag: string, fn: () => Promise<{ error?: string; ok?: boolean; stored?: number; scanned?: number } | undefined>) => {
    setBusy(tag); setMsg(null);
    const res = await fn();
    setBusy(null);
    if (res?.error) { setMsg(res.error); return; }
    if (typeof res?.stored === "number") setMsg(`Scanned ${res.scanned}, captured ${res.stored} new signal(s).`);
    router.refresh();
  };

  const counts = STATUS_TABS.reduce((a, s) => ({ ...a, [s]: results.filter((r) => r.status === s).length }), {} as Record<string, number>);
  const shown = results.filter((r) => r.status === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2"><RadioTower className="w-6 h-6 text-purple" /> Online Listening</h1>
          <p className="text-sm text-muted mt-1">Watches your connected Meta assets for abuse keywords and flags them for review.</p>
        </div>
        <button onClick={() => run("poll", pollMeta)} disabled={busy !== null || !connected}
          title={connected ? "Scan recent posts now" : "Connect Meta to enable syncing"}
          className="inline-flex items-center gap-2 rounded-lg bg-purple text-white px-4 h-10 text-sm font-bold hover:bg-purple/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy === "poll" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync now
        </button>
      </div>

      {/* Connection status */}
      {connected ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800"><span className="font-bold">Connected to Meta.</span> New comments on your Page are matched in real time via the webhook; use Sync now to backfill recent posts.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-paper p-5">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-purple/10 text-purple grid place-items-center shrink-0"><Plug className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 className="font-bold text-ink">Connect Meta to activate listening</h3>
              <p className="text-sm text-muted mt-0.5">Everything is wired up and waiting on your Meta credentials. You can add and fine-tune the watch keywords below right now; captured signals will appear here the moment it is connected.</p>
              <ol className="mt-3 space-y-1.5 text-sm text-muted list-decimal pl-5">
                <li>Add <code>META_PAGE_ID</code>, <code>META_ACCESS_TOKEN</code>, <code>META_APP_SECRET</code> and <code>META_VERIFY_TOKEN</code> to the environment.</li>
                <li>In the Meta App dashboard, point the Page webhook at <code>/api/meta/webhook</code> and subscribe to &quot;feed&quot;.</li>
                <li>Come back here and use <span className="font-semibold">Sync now</span> to pull in recent posts.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      {msg && <p className="text-sm font-semibold text-purple">{msg}</p>}

      {/* Keyword manager */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-bold text-ink flex items-center gap-2"><Search className="w-4 h-4 text-purple" /> Watch keywords</h2>
        <p className="text-xs text-muted mt-1">Comments and posts containing these words are captured. High-severity words are surfaced first.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {keywords.map((k) => (
            <span key={k.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${k.active ? SEV[k.severity] ?? SEV.low : "bg-paper text-muted border-line line-through opacity-60"}`}>
              <button onClick={() => run(`t-${k.id}`, () => toggleKeyword(k.id, !k.active))} title={k.active ? "Mute" : "Activate"} className="hover:opacity-70">
                {k.active ? <Circle className="w-2.5 h-2.5 fill-current" /> : <EyeOff className="w-3 h-3" />}
              </button>
              {k.word}
              <button onClick={() => run(`d-${k.id}`, () => removeKeyword(k.id))} title="Remove" className="hover:opacity-70">
                {busy === `d-${k.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </span>
          ))}
          {keywords.length === 0 && <p className="text-sm text-muted">No keywords yet. Add some below.</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="Add a keyword"
            onKeyDown={(e) => { if (e.key === "Enter" && newWord.trim()) run("add", async () => { const r = await addKeyword(newWord, newSev); if (!r?.error) setNewWord(""); return r; }); }}
            className="rounded-lg border border-line bg-surface px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30" />
          <select value={newSev} onChange={(e) => setNewSev(e.target.value)} className="rounded-lg border border-line bg-surface px-2 h-9 text-sm">
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <button onClick={() => run("add", async () => { const r = await addKeyword(newWord, newSev); if (!r?.error) setNewWord(""); return r; })} disabled={busy !== null || !newWord.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 h-9 text-sm font-semibold hover:bg-paper disabled:opacity-50">
            {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </section>

      {/* Results */}
      <section>
        <div className="flex gap-1 rounded-lg border border-line bg-paper p-1 w-fit mb-4">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold capitalize transition-colors ${tab === s ? "bg-surface text-purple shadow-sm" : "text-muted hover:text-ink"}`}>
              {s} {counts[s] ? <span className="ml-1 text-xs opacity-70">{counts[s]}</span> : null}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
            <RadioTower className="w-8 h-8 mx-auto text-purple/60" />
            <p className="mt-3">No {tab} signals. {connected ? "Try Sync now to scan recent posts." : "Connect Meta to start capturing."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {shown.map((r) => (
              <article key={r.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${SEV[r.severity] ?? SEV.low}`}>{r.severity}</span>
                  <span className="text-xs text-muted capitalize">{r.source} · {new Date(r.captured_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm text-ink line-clamp-4">{r.content}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.matched_keywords.map((w) => <span key={w} className="text-[11px] rounded bg-purple/10 text-purple px-1.5 py-0.5 font-semibold">{w}</span>)}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <div className="flex items-center gap-1.5">
                    {r.status !== "reviewing" && <StatusBtn label="Review" onClick={() => run(`s-${r.id}`, () => setResultStatus(r.id, "reviewing"))} busy={busy === `s-${r.id}`} />}
                    {r.status !== "actioned" && <StatusBtn label="Actioned" onClick={() => run(`s-${r.id}`, () => setResultStatus(r.id, "actioned"))} busy={busy === `s-${r.id}`} />}
                    {r.status !== "dismissed" && <StatusBtn label="Dismiss" onClick={() => run(`s-${r.id}`, () => setResultStatus(r.id, "dismissed"))} busy={busy === `s-${r.id}`} />}
                  </div>
                  {r.author && <span className="text-xs text-muted truncate max-w-[8rem]">{r.author}</span>}
                  {r.permalink && <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="text-purple shrink-0" title="Open on Meta"><ExternalLink className="w-4 h-4" /></a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBtn({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink hover:bg-paper disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : label}
    </button>
  );
}
