"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { addSource, toggleSource, removeSource, togglePack } from "@/app/actions/listening";
import type { PackState } from "@/lib/listening-packs";
import type { Source } from "@/lib/listening-sources";
import { SUGGESTED_SOURCES } from "@/lib/listening-suggestions";
import { PLATFORM_LABEL, type Run } from "./types";

type Platform = "instagram" | "x" | "facebook";

/** The accounts and hashtags being listened to: add, pause (kept on the list but ignored) or remove. */
export function WatchingPanel({ sources, packs, run, busy }: { sources: Source[]; packs: PackState[]; run: Run; busy: string | null }) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [kind, setKind] = useState<"profile" | "hashtag">("profile");
  const [value, setValue] = useState("");

  const suggestions = SUGGESTED_SOURCES.filter(
    (g) => !sources.some((x) => x.platform === g.platform && x.kind === g.kind && x.handle.toLowerCase() === g.handle.toLowerCase()),
  );
  // Group the suggestions by organisation, one row each, with a button per platform.
  const orgs = [...new Set(suggestions.map((g) => g.name))];

  return (
    <div className="space-y-6">
      {packs.length > 0 && (
        <section className="card-premium p-5 sm:p-7">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Preset listening</h2>
          <p className="mt-1 text-sm text-muted">Set up for you and switched on. Posts from these are indexed as cases automatically. Turn a pack off to pause it; nothing already captured is removed.</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {packs.map((p) => (
              <li key={p.id} className={`rounded-2xl border p-4 transition-colors ${p.enabled ? "border-purple/30 bg-purple-050/40" : "border-line bg-surface"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{p.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{p.blurb}</p>
                    <p className="mt-2 text-[11px] font-semibold text-muted">
                      {[p.accounts ? `${p.accounts} account${p.accounts === 1 ? "" : "s"}` : null, p.words ? `${p.words} words` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={p.enabled}
                    aria-label={`${p.name} listening`}
                    onClick={() => run(`pack-${p.id}`, () => togglePack(p.id, !p.enabled))}
                    disabled={busy !== null}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${p.enabled ? "bg-purple" : "bg-line"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.enabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-premium p-5 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">Listening to</h2>
        <p className="mt-1 text-sm text-muted">
          Their latest public posts are read every day. Pause an account to stop listening to it while keeping it on the list: its posts are ignored wherever they appear.
        </p>

        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {sources.length === 0 && <li className="p-4 text-sm text-muted">Nothing yet. Add an account or hashtag below, or pick a suggestion.</li>}
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className={`text-sm font-semibold ${s.active ? "text-ink" : "text-muted line-through"}`}>
                {s.kind === "hashtag" ? "#" : "@"}{s.handle}
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-muted">{PLATFORM_LABEL[s.platform] ?? s.platform}</span>
              {s.pack && <span className="rounded-full bg-purple-050 px-2 py-0.5 text-[11px] font-semibold text-purple-700">Preset</span>}
              {s.index_all && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Every post indexed</span>}
              <span className="text-xs text-muted">
                {!s.active
                  ? s.kind === "profile" ? "Paused. Its posts are ignored." : "Paused."
                  : s.last_scanned_at ? `Last read ${new Date(s.last_scanned_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}${s.last_result ? `, ${s.last_result}` : ""}` : "Not read yet"}
              </span>
              <span className="ml-auto flex items-center gap-3">
                <button onClick={() => run(`ts-${s.id}`, () => toggleSource(s.id, !s.active))} disabled={busy !== null} className="text-xs font-semibold text-purple hover:underline disabled:opacity-50">
                  {s.active ? "Pause" : "Resume"}
                </button>
                <button onClick={() => run(`rs-${s.id}`, () => removeSource(s.id))} disabled={busy !== null} className="text-xs font-semibold text-muted hover:text-rose-600 disabled:opacity-50">Remove</button>
              </span>
            </li>
          ))}
        </ul>

        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            run("addsrc", async () => { const r = await addSource(platform, platform === "facebook" ? "profile" : kind, value); if (!r?.error) setValue(""); return r; });
          }}
        >
          <select value={platform} onChange={(e) => { const v = e.target.value as Platform; setPlatform(v); if (v === "facebook") setKind("profile"); }} aria-label="Platform" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
            <option value="instagram">Instagram</option><option value="x">X</option><option value="facebook">Facebook page</option>
          </select>
          {platform !== "facebook" && (
            <select value={kind} onChange={(e) => setKind(e.target.value as "profile" | "hashtag")} aria-label="Account or hashtag" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
              <option value="profile">Account</option><option value="hashtag">Hashtag</option>
            </select>
          )}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={platform === "facebook" ? "Page name, as in facebook.com/pagename" : kind === "hashtag" ? "One or more hashtags" : "One or more account names"}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
          <button type="submit" disabled={busy !== null || !value.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-purple px-4 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
            {busy === "addsrc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Listen
          </button>
        </form>
      </section>

      {orgs.length > 0 && (
        <section className="card-premium p-5 sm:p-7">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Suggested accounts</h2>
          <p className="mt-1 text-sm text-muted">Organisations that document abuse and disappearances. Nothing is listened to until you add it.</p>
          <ul className="mt-4 divide-y divide-line">
            {orgs.map((name) => {
              const items = suggestions.filter((g) => g.name === name);
              return (
                <li key={name} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-muted">{items[0].focus}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((g) => (
                      <button
                        key={`${g.platform}-${g.handle}`}
                        onClick={() => run(`sg-${g.platform}-${g.handle}`, () => addSource(g.platform, g.kind, g.handle))}
                        disabled={busy !== null}
                        title={g.check ?? `@${g.handle}`}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink hover:bg-purple-050 disabled:opacity-50"
                      >
                        {busy === `sg-${g.platform}-${g.handle}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 text-purple" />}
                        {PLATFORM_LABEL[g.platform]}{g.check ? <span className="text-muted"> (check)</span> : null}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
