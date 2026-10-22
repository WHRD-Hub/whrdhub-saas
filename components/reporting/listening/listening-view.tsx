"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RadioTower, RefreshCw } from "lucide-react";
import { scanAllNow } from "@/app/actions/listening";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Source } from "@/lib/listening-sources";
import type { PackState } from "@/lib/listening-packs";
import { Inbox } from "./inbox";
import { WatchingPanel } from "./watching-panel";
import { KeywordsPanel } from "./keywords-panel";
import { CheckPanel } from "./check-panel";
import type { ActionResult, InboxData, Keyword, Result, Run } from "./types";

export type { Keyword, Result };

type Tab = "inbox" | "watching" | "keywords" | "check";

/**
 * Online listening. The inbox is the point of the page, so it comes first and
 * the setup screens sit one click away behind quiet tabs. Outcomes appear as
 * toasts rather than banners, so nothing shoves the content around.
 */
export function ListeningView({ sources, keywords, inbox, packs }: { sources: Source[]; keywords: Keyword[]; inbox: InboxData; packs: PackState[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [busy, setBusy] = useState<string | null>(null);

  const run: Run = async (tag, fn) => {
    setBusy(tag);
    let res: ActionResult;
    try {
      res = await fn();
    } catch {
      res = { error: "Something went wrong. Please try again." };
    }
    setBusy(null);
    if (res?.error) {
      toast.error(res.error);
    } else {
      if (typeof res?.added === "number") toast.success(res.added ? `Added ${res.added} word${res.added === 1 ? "" : "s"}.` : "Those words are already on your list.");
      else if (typeof res?.stored === "number") toast.success(res.scanned ? `Looked at ${res.scanned} post${res.scanned === 1 ? "" : "s"}: ${res.stored} new in your inbox${res.existing ? `, ${res.existing} already there` : ""}.` : "Scan finished. Nothing new to look at.");
      if (res?.problems?.length) toast.error(res.problems.slice(0, 2).join(" · "));
    }
    router.refresh();
    return res;
  };

  const freshCount = inbox.counts.new ?? 0;
  const freshReal = inbox.likelyNew;
  const watching = sources.filter((s) => s.active).length;
  const lastScan = sources.map((s) => s.last_scanned_at).filter(Boolean).sort().pop() ?? null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "inbox", label: "Inbox", count: freshCount },
    { id: "watching", label: "Listening to", count: watching },
    { id: "keywords", label: "Words" },
    { id: "check", label: "Check a post" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Early warning</p>
          <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight text-ink">
            <RadioTower className="h-7 w-7 text-purple" /> Online listening
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {freshReal > 0
              ? <><span className="font-semibold text-rose-600">{freshReal} likely real case{freshReal === 1 ? "" : "s"}</span> waiting for the team. </>
              : freshCount > 0 ? `${freshCount.toLocaleString()} new capture${freshCount === 1 ? "" : "s"} to look at. ` : "Nothing waiting. "}
            Shared by every admin and scanned every day
            {lastScan && <>, last at {new Date(lastScan).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>}.
          </p>
        </div>
        <button
          onClick={() => run("all", scanAllNow)}
          disabled={busy !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-purple px-5 text-sm font-semibold text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
        >
          {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Scan now
        </button>
      </header>

      <div role="tablist" aria-label="Online listening" className="flex gap-6 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-3 text-sm font-semibold transition-colors",
              tab === t.id ? "border-purple text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count ? <span className={cn("ml-1.5 rounded-full px-1.5 text-[11px] font-bold", tab === t.id ? "bg-purple-050 text-purple-700" : "bg-paper text-muted")}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "inbox" && <Inbox data={inbox} run={run} busy={busy} />}
      {tab === "watching" && <WatchingPanel sources={sources} packs={packs} run={run} busy={busy} />}
      {tab === "keywords" && <KeywordsPanel keywords={keywords} run={run} busy={busy} />}
      {tab === "check" && <CheckPanel run={run} busy={busy} />}
    </div>
  );
}
