"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Inbox as InboxIcon, Loader2, MoreHorizontal, UserRoundX } from "lucide-react";
import { setResultStatus, muteAccount, takeOnCapture } from "@/app/actions/listening";
import { Modal } from "@/components/ui/modal";
import { FilterBar, Segmented } from "@/components/ui/filter-bar";
import { cn, timeAgo } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";
import { PostView } from "./post-embed";
import { TagSuggestions } from "./tag-suggestions";
import { extractTags } from "@/lib/hashtags";
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
 * dismiss, e to mark actioned), and while you are on the first page of New it
 * quietly refreshes and tells you what has arrived since you opened it.
 */
export function Inbox({ data, run, busy }: { data: InboxData; run: Run; busy: string | null }) {
  const { results, total, page, pageSize, counts, status, tagSuggestions } = data;
  const router = useRouter();
  const url = useUrlParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
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


  // Keyboard: work the list without the mouse. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !selected) return;
      const idx = results.findIndex((r) => r.id === selected.id);
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSelectedId(results[Math.min(idx + 1, results.length - 1)].id); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSelectedId(results[Math.max(idx - 1, 0)].id); }
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Status"
          items={STATUSES.map((s) => ({ id: s.id, label: s.label, count: counts[s.id] }))}
          value={status as Status}
          onSelect={(id) => { setSelectedId(null); url.set({ status: id === "new" ? null : id }); }}
        />
        <FilterBar
        compact
        filters={filters}
        values={Object.fromEntries(filters.map((f) => [f.key, url.get(f.key)]))}
        busy={url.pending}
        search={{ value: search, onChange: onSearch, placeholder: "Search posts and accounts" }}
        onChange={(key, value) => url.set({ [key]: value || null })}
        onClear={() => { setSearch(""); url.set({ q: null, platform: null, severity: null, label: null }); }}
        trailing={status === "new" && page === 1 ? (
          <p className="ml-auto flex items-center gap-1.5 pr-1 text-xs text-muted" title="This list refreshes by itself">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            Live
          </p>
        ) : null}
      />
      </div>

      <TagSuggestions tags={tagSuggestions} run={run} busy={busy} />

      {arrived > 0 && (
        <button onClick={() => { setOpenedAt(Date.now()); setSelectedId(null); }} className="w-full rounded-xl border border-purple/20 bg-purple-050 px-4 py-2 text-center text-xs font-semibold text-purple-700 hover:bg-purple/10">
          {arrived} new since you opened this page. Mark as seen.
        </button>
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
        <div className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-line lg:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/60 px-3 py-1.5 text-xs text-muted">
              <span>{total === 0 ? "No captures" : <>{from + 1}–{Math.min(from + pageSize, total)} of <span className="font-semibold text-ink">{total.toLocaleString()}</span></>}</span>
              {pages > 1 && (
                <span className="flex items-center gap-1">
                  <button onClick={() => url.set({ page: page > 2 ? String(page - 1) : null }, { keepPage: true })} disabled={page <= 1} aria-label="Previous page" className="rounded-md p-1 hover:bg-surface disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <span>{page}/{pages}</span>
                  <button onClick={() => url.set({ page: String(page + 1) }, { keepPage: true })} disabled={page >= pages} aria-label="Next page" className="rounded-md p-1 hover:bg-surface disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </span>
              )}
            </div>
            <ul className={cn("max-h-[calc(100dvh-8.5rem)] min-h-[20rem] divide-y divide-line overflow-y-auto", url.pending && "opacity-60")} role="listbox" aria-label="Captures">
              {results.map((r) => {
                const on = selected?.id === r.id;
                return (
                  <li key={r.id} role="option" aria-selected={on} className={cn("flex items-stretch transition-colors hover:bg-paper", on && "bg-purple-050/60")}>
                    <button onClick={() => { setSelectedId(r.id); setSheet(true); }} className="block min-w-0 flex-1 px-3.5 py-2.5 text-left">
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
          </div>

          {/* Detail, side by side on large screens */}
          <div className="hidden max-h-[calc(100dvh-5.5rem)] min-h-[24rem] overflow-y-auto lg:block">{detail}</div>
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
  const tags = extractTags(r.content);
  const canMute = !!r.author && (r.source === "instagram" || r.source === "x");
  const [menu, setMenu] = useState(false);

  const btn = (to: string, label: string, primary = false) => (
    <button
      key={to}
      onClick={() => onMove(to)}
      disabled={busy !== null}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-50",
        primary ? "bg-purple text-white hover:bg-purple-600" : "border border-line bg-surface text-ink hover:bg-paper",
      )}
    >
      {label}
    </button>
  );

  return (
    <article className="flex min-h-full flex-col">
      {/* Who and what to do, on one line that stays in view while the post scrolls */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] text-muted">
            <span className="font-semibold uppercase tracking-wider">{PLATFORM_LABEL[r.source] ?? r.source}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[r.severity] ?? SEVERITY_DOT.low)} title={`${r.severity} severity`} />
            <span>{new Date(r.captured_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            {r.handled_by_name && r.status !== "new" && (
              <span>· {r.status === "reviewing" ? "with" : r.status === "actioned" ? "actioned by" : "dismissed by"} <span className="font-semibold text-ink">{r.handled_by_name}</span>{r.handled_at ? `, ${timeAgo(r.handled_at)}` : ""}</span>
            )}
          </p>
          <h2 className="truncate text-base font-bold tracking-tight text-ink">{r.author ?? "Unknown account"}</h2>
        </div>

        <div className="relative flex flex-wrap items-center gap-1.5">
          {r.report_id && (
            <Link href={`/hub/reporting/reports/${r.report_id}`} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-purple px-3 text-[13px] font-semibold text-white hover:bg-purple-600">
              Open case <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {r.status === "new" && [
            <button key="take" onClick={onTakeOn} disabled={busy !== null} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-purple px-3 text-[13px] font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
              {working ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening…</> : <>Take on <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>,
            btn("actioned", "Actioned"), btn("dismissed", "Dismiss"),
          ]}
          {r.status === "reviewing" && [btn("actioned", "Mark actioned", !r.report_id), btn("dismissed", "Dismiss"), !r.report_id && btn("new", "Put back")]}
          {(r.status === "actioned" || r.status === "dismissed") && btn("new", "Reopen")}

          <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
          {r.permalink && (
            <a href={r.permalink} target="_blank" rel="noopener noreferrer" title="Open the original post" aria-label="Open the original post" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-purple hover:bg-paper">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canMute && (
            <>
              <button onClick={() => setMenu((v) => !v)} aria-label="More about this account" aria-expanded={menu} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-paper hover:text-ink">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menu && (
                <>
                  <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                  <div role="menu" className="absolute right-0 top-9 z-20 w-60 rounded-lg border border-line bg-surface p-1 shadow-lg">
                    <button
                      role="menuitem"
                      onClick={() => { setMenu(false); onMute(); }}
                      disabled={busy !== null}
                      className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-paper disabled:opacity-50"
                    >
                      <UserRoundX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                      <span>
                        <span className="block text-[13px] font-semibold text-ink">Stop listening to {r.author}</span>
                        <span className="block text-[11px] leading-snug text-muted">Pauses the account. Its posts are ignored from now on.</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {/* The post reads top to bottom in its own column; what we know about it sits beside it */}
      <div className="grid items-start gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <PostView key={r.id} permalink={r.permalink}>
          <blockquote className="whitespace-pre-line rounded-lg border border-line bg-paper/70 p-3.5 text-sm leading-relaxed text-ink">{r.content}</blockquote>
        </PostView>

        <aside className="space-y-3">
          {ai && (
            <p className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", ai.cls)}>
              {ai.label}
              {typeof r.ai_confidence === "number" && <span className="opacity-70">{Math.round(r.ai_confidence * 100)}% sure</span>}
            </p>
          )}
          {r.matched_keywords.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted">Words matched</p>
              <div className="flex flex-wrap gap-1.5">
                {r.matched_keywords.map((w) => <span key={w} className="rounded-full bg-purple-050 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{w}</span>)}
              </div>
            </div>
          )}
          {tags.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => <span key={t} className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-muted">#{t}</span>)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
