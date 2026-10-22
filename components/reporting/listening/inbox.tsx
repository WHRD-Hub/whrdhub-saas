"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Inbox as InboxIcon, Loader2, UserRoundX, X } from "lucide-react";
import { setResultStatus, setResultsStatus, muteAccount, takeOnCapture } from "@/app/actions/listening";
import { Modal } from "@/components/ui/modal";
import { FilterBar, Segmented } from "@/components/ui/filter-bar";
import { cn, timeAgo } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";
import { AI_LABEL, PLATFORM_LABEL, SEVERITY_DOT, isLikelyReal, type InboxData, type Result, type Run } from "./types";

const STATUSES = [
  { id: "new", label: "New" },
  { id: "reviewing", label: "In review" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
] as const;

type Status = (typeof STATUSES)[number]["id"];

const REFRESH_MS = 45_000;

/**
 * The shared inbox, built for a stream rather than a handful. Search, filters and
 * paging happen on the server, so it stays quick however many captures arrive.
 * The list can be worked from the keyboard (j/k to move, t to take on, d to
 * dismiss, e to mark actioned, x to select), several captures can be closed in
 * one go, and while you are on the first page of New it quietly refreshes and
 * tells you what has arrived since you opened it.
 */
export function Inbox({ data, run, busy }: { data: InboxData; run: Run; busy: string | null }) {
  const { results, total, page, pageSize, counts, status } = data;
  const router = useRouter();
  const url = useUrlParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(url.get("q"));
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = results.find((r) => r.id === selectedId) ?? results[0] ?? null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;

  // Quiet refresh while watching the newest captures, so the stream is live without a button.
  useEffect(() => {
    if (status !== "new" || page !== 1) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [status, page, router]);

  const arrived = useMemo(
    () => (status === "new" && page === 1 ? results.filter((r) => new Date(r.captured_at).getTime() > openedAt).length : 0),
    [results, status, page, openedAt],
  );

  const move = async (r: Result, to: string) => {
    const idx = results.findIndex((x) => x.id === r.id);
    const next = results[idx + 1] ?? results[idx - 1] ?? null;
    await run(`s-${r.id}`, () => setResultStatus(r.id, to));
    setSelectedId(next?.id ?? null);
    setSheet(false);
  };

  /** Taking on opens a case: a normal report with the post and every tool, and we go straight to it. */
  const takeOn = async (r: Result) => {
    const res = await run(`s-${r.id}`, () => takeOnCapture(r.id));
    if (res?.reportId) router.push(`/hub/reporting/reports/${res.reportId}`);
  };

  const bulk = async (to: string) => {
    const ids = [...checked];
    await run("bulk", () => setResultsStatus(ids, to));
    setChecked(new Set());
  };

  const flip = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = results.length > 0 && results.every((r) => checked.has(r.id));

  // Keyboard: work the list without the mouse. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !selected) return;
      const idx = results.findIndex((r) => r.id === selected.id);
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSelectedId(results[Math.min(idx + 1, results.length - 1)].id); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSelectedId(results[Math.max(idx - 1, 0)].id); }
      else if (e.key === "x") flip(selected.id);
      else if (busy === null) {
        if (e.key === "t" && selected.status === "new") takeOn(selected);
        else if (e.key === "d") move(selected, "dismissed");
        else if (e.key === "e") move(selected, "actioned");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // takeOn and move close over the current list; they are re-created with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selected, busy]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => url.set({ q: v.trim() || null }), 350);
  };

  const filters = [
    { key: "platform", label: "Platform", options: [{ value: "x", label: "X" }, { value: "instagram", label: "Instagram" }, { value: "facebook", label: "Facebook" }] },
    { key: "severity", label: "Severity", options: [{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }] },
    { key: "label", label: "Kind", options: [{ value: "likely", label: "Likely real cases" }, { value: "missing", label: "Missing persons" }, { value: "awareness", label: "Awareness or news" }] },
  ];

  const detail = selected ? (
    <Detail r={selected} busy={busy} onTakeOn={() => takeOn(selected)} onMove={(to) => move(selected, to)} onMute={() => run(`mute-${selected.id}`, () => muteAccount(selected.source, selected.author ?? ""))} />
  ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Status"
          items={STATUSES.map((s) => ({ id: s.id, label: s.label, count: counts[s.id] }))}
          value={status as Status}
          onSelect={(id) => { setChecked(new Set()); setSelectedId(null); url.set({ status: id === "new" ? null : id }); }}
        />
        {status === "new" && page === 1 && (
          <p className="flex items-center gap-1.5 text-xs text-muted" title="This list refreshes by itself">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            Live
          </p>
        )}
      </div>

      <FilterBar
        filters={filters}
        values={Object.fromEntries(filters.map((f) => [f.key, url.get(f.key)]))}
        busy={url.pending}
        search={{ value: search, onChange: onSearch, placeholder: "Search posts and accounts" }}
        onChange={(key, value) => url.set({ [key]: value || null })}
        onClear={() => { setSearch(""); url.set({ q: null, platform: null, severity: null, label: null }); }}
      />

      {arrived > 0 && (
        <button onClick={() => { setOpenedAt(Date.now()); setSelectedId(null); }} className="w-full rounded-xl border border-purple/20 bg-purple-050 px-4 py-2 text-center text-xs font-semibold text-purple-700 hover:bg-purple/10">
          {arrived} new since you opened this page. Mark as seen.
        </button>
      )}

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
          <span className="font-semibold">{checked.size} selected</span>
          <span className="flex items-center gap-2">
            <button onClick={() => bulk("actioned")} disabled={busy !== null} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 disabled:opacity-50">Mark actioned</button>
            <button onClick={() => bulk("dismissed")} disabled={busy !== null} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 disabled:opacity-50">
              {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Dismiss"}
            </button>
            <button onClick={() => setChecked(new Set())} aria-label="Clear selection" className="rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
          </span>
        </div>
      )}

      {results.length === 0 ? (
        <div className="card-premium grid place-items-center px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-050 text-purple"><InboxIcon className="h-6 w-6" /></span>
          <p className="mt-4 text-lg font-semibold text-ink">{url.get("q") ? "No captures match" : status === "new" ? "You are all caught up" : "Nothing here"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {url.get("q") || url.get("platform") || url.get("severity") || url.get("label")
              ? "Try a different search, or clear the filters."
              : status === "new"
                ? "New captures appear after each scan, and this page refreshes by itself."
                : `Captures you ${status === "reviewing" ? "take on" : status === "actioned" ? "act on" : "dismiss"} are listed here for the whole team.`}
          </p>
        </div>
      ) : (
        <div className="card-premium grid overflow-hidden lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-line lg:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/60 px-4 py-2 text-xs text-muted">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={allOnPage} onChange={() => setChecked(allOnPage ? new Set() : new Set(results.map((r) => r.id)))} className="accent-[#734e9e]" aria-label="Select all on this page" />
                <span>{total === 0 ? "No captures" : <>{from + 1}–{Math.min(from + pageSize, total)} of <span className="font-semibold text-ink">{total.toLocaleString()}</span></>}</span>
              </label>
              {pages > 1 && (
                <span className="flex items-center gap-1">
                  <button onClick={() => url.set({ page: page > 2 ? String(page - 1) : null }, { keepPage: true })} disabled={page <= 1} aria-label="Previous page" className="rounded-md p-1 hover:bg-surface disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <span>{page}/{pages}</span>
                  <button onClick={() => url.set({ page: String(page + 1) }, { keepPage: true })} disabled={page >= pages} aria-label="Next page" className="rounded-md p-1 hover:bg-surface disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </span>
              )}
            </div>
            <ul className={cn("max-h-[calc(100dvh-22rem)] min-h-[20rem] divide-y divide-line overflow-y-auto", url.pending && "opacity-60")} role="listbox" aria-label="Captures">
              {results.map((r) => {
                const on = selected?.id === r.id;
                return (
                  <li key={r.id} role="option" aria-selected={on} className={cn("flex items-stretch transition-colors hover:bg-paper", on && "bg-purple-050/60")}>
                    <label className="flex shrink-0 cursor-pointer items-start px-3 pt-4">
                      <input type="checkbox" checked={checked.has(r.id)} onChange={() => flip(r.id)} aria-label={`Select capture from ${r.author ?? "unknown account"}`} className="accent-[#734e9e]" />
                    </label>
                    <button onClick={() => { setSelectedId(r.id); setSheet(true); }} className="block min-w-0 flex-1 py-3 pr-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[r.severity] ?? SEVERITY_DOT.low)} title={`${r.severity} severity`} />
                        <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{r.author ?? "Unknown account"}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted">{timeAgo(r.captured_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink/65">{r.content}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span>{PLATFORM_LABEL[r.source] ?? r.source}</span>
                        {r.ai_class === "missing_person" ? <span className="font-semibold text-rose-600">Missing person</span> : isLikelyReal(r.ai_class) && <span className="font-semibold text-rose-600">Likely real</span>}
                        {r.report_id && <span className="font-semibold text-purple-700">Case open</span>}
                        {r.status === "reviewing" && r.handled_by_name && <span className="font-semibold text-purple-700">With {r.handled_by_name}</span>}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="hidden border-t border-line px-4 py-2 text-[11px] text-muted lg:block">
              <kbd className="rounded bg-paper px-1">j</kbd> <kbd className="rounded bg-paper px-1">k</kbd> move · <kbd className="rounded bg-paper px-1">t</kbd> take on · <kbd className="rounded bg-paper px-1">e</kbd> actioned · <kbd className="rounded bg-paper px-1">d</kbd> dismiss · <kbd className="rounded bg-paper px-1">x</kbd> select
            </p>
          </div>

          {/* Detail, side by side on large screens */}
          <div className="hidden min-h-[24rem] lg:block">{detail}</div>
        </div>
      )}

      {/* Detail as a sheet on small screens */}
      <div className="lg:hidden">
        <Modal open={sheet && !!selected} onClose={() => setSheet(false)} title="Capture">
          {detail}
        </Modal>
      </div>
    </div>
  );
}

function Detail({ r, busy, onMove, onTakeOn, onMute }: { r: Result; busy: string | null; onMove: (to: string) => void; onTakeOn: () => void; onMute: () => void }) {
  const ai = r.ai_class ? AI_LABEL[r.ai_class] : null;
  const working = busy === `s-${r.id}`;
  const canMute = !!r.author && (r.source === "instagram" || r.source === "x");

  const btn = (to: string, label: string, primary = false) => (
    <button
      key={to}
      onClick={() => onMove(to)}
      disabled={busy !== null}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50",
        primary ? "bg-purple text-white hover:bg-purple-600" : "border border-line bg-surface text-ink hover:bg-paper",
      )}
    >
      {label}
    </button>
  );

  return (
    <article className="flex h-full flex-col p-5 sm:p-7">
      <header>
        <p className="eyebrow">{PLATFORM_LABEL[r.source] ?? r.source}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{r.author ?? "Unknown account"}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Captured {new Date(r.captured_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", SEVERITY_DOT[r.severity] ?? SEVERITY_DOT.low)} />{r.severity} severity</span>
        </p>
      </header>

      {ai && (
        <p className={cn("mt-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", ai.cls)}>
          {ai.label}
          {typeof r.ai_confidence === "number" && <span className="opacity-70">{Math.round(r.ai_confidence * 100)}% sure</span>}
        </p>
      )}

      <blockquote className="mt-4 whitespace-pre-line rounded-2xl bg-paper p-4 text-[15px] leading-relaxed text-ink">{r.content}</blockquote>

      {r.matched_keywords.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-1.5">Matched</p>
          <div className="flex flex-wrap gap-1.5">
            {r.matched_keywords.map((w) => <span key={w} className="rounded-full bg-purple-050 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{w}</span>)}
          </div>
        </div>
      )}

      {r.permalink && (
        <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-purple hover:underline">
          Open the original post <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <footer className="mt-auto pt-6">
        {r.handled_by_name && r.status !== "new" && (
          <p className="mb-3 text-xs text-muted">
            {r.status === "reviewing" ? "Being reviewed by" : r.status === "actioned" ? "Actioned by" : "Dismissed by"}{" "}
            <span className="font-semibold text-ink">{r.handled_by_name}</span>
            {r.handled_at ? `, ${timeAgo(r.handled_at)}` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {r.report_id && (
            <Link href={`/hub/reporting/reports/${r.report_id}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-purple px-4 text-sm font-semibold text-white hover:bg-purple-600">
              Open case <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {r.status === "new" && [
            <button key="take" onClick={onTakeOn} disabled={busy !== null} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-purple px-4 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
              {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening case…</> : <>Take on <ArrowRight className="h-4 w-4" /></>}
            </button>,
            btn("actioned", "Mark actioned"), btn("dismissed", "Dismiss"),
          ]}
          {r.status === "reviewing" && [btn("actioned", "Mark actioned", !r.report_id), btn("dismissed", "Dismiss"), !r.report_id && btn("new", "Put back")]}
          {(r.status === "actioned" || r.status === "dismissed") && btn("new", "Reopen")}
        </div>
        {canMute && (
          <button onClick={onMute} disabled={busy !== null} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-rose-600 disabled:opacity-50">
            <UserRoundX className="h-3.5 w-3.5" /> Stop listening to this account
          </button>
        )}
      </footer>
    </article>
  );
}
