"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, BookOpen, Building2, ChevronRight, Paperclip, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/hub/empty-state";

export interface InboxItem {
  id: string;
  title: string;
  author?: string;
  county?: string;
  when: string;
  hasMedia?: boolean;
}

type TabId = "posts" | "cbos" | "blogs";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof FileText;
  href: (id: string) => string;
  empty: string;
  cols: string; // grid template
  headers: string[]; // excluding trailing chevron
  kind: "content" | "cbo";
}

const TABS: TabDef[] = [
  { id: "posts", label: "Posts", icon: FileText, href: (id) => `/hub/posts/${id}`, empty: "No posts are waiting for review.", cols: "1.7fr 1fr 0.8fr 90px 24px", headers: ["Post", "Author", "County", "Submitted"], kind: "content" },
  { id: "cbos", label: "CBOs", icon: Building2, href: (id) => `/hub/organizations/${id}`, empty: "No organisations are waiting for verification.", cols: "1.7fr 1fr 90px 24px", headers: ["Organisation", "County", "Added"], kind: "cbo" },
  { id: "blogs", label: "Stories", icon: BookOpen, href: (id) => `/hub/blogs/${id}`, empty: "No stories are waiting for review.", cols: "1.7fr 1fr 0.8fr 90px 24px", headers: ["Story", "Author", "County", "Submitted"], kind: "content" },
];

/**
 * "Needs your attention" inbox on the Hub overview. A clean table with a
 * Posts / CBOs / Stories toggle, richer columns, and a friendly empty state.
 * Every row opens the matching detail page.
 */
export function ReviewInbox({ posts, cbos, blogs }: { posts: InboxItem[]; cbos: InboxItem[]; blogs: InboxItem[] }) {
  const data: Record<TabId, InboxItem[]> = { posts, cbos, blogs };
  const counts: Record<TabId, number> = { posts: posts.length, cbos: cbos.length, blogs: blogs.length };
  const firstNonEmpty = (TABS.find((t) => counts[t.id] > 0)?.id ?? "posts") as TabId;
  const [tab, setTab] = useState<TabId>(firstNonEmpty);

  const active = TABS.find((t) => t.id === tab)!;
  const items = data[tab];
  const total = counts.posts + counts.cbos + counts.blogs;

  return (
    <section className="rounded-xl border border-line bg-surface overflow-hidden">
      {/* Header + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <h2 className="font-black text-ink leading-tight">Needs your attention</h2>
          <p className="text-xs text-muted">{total} item{total === 1 ? "" : "s"} waiting across the network</p>
        </div>
        <div className="flex gap-1 rounded-[7px] border border-line bg-paper p-1">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors", on ? "bg-surface text-purple-700 shadow-sm" : "text-ink/60 hover:text-ink")}>
                <t.icon className="w-4 h-4" /> {t.label}
                {counts[t.id] > 0 && (
                  <span className={cn("text-[11px] font-bold rounded-full px-1.5 min-w-[18px] text-center", on ? "bg-purple text-white" : "bg-purple-050 text-purple-700")}>{counts[t.id]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="You are all caught up" subtitle={active.empty} />
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 560 }}>
            <div className="grid gap-3 px-5 py-2.5 bg-paper/50 border-b border-line text-xs font-bold uppercase tracking-wide text-muted" style={{ gridTemplateColumns: active.cols }}>
              {active.headers.map((h) => <span key={h}>{h}</span>)}
              <span />
            </div>
            <div className="divide-y divide-line">
              {items.map((item) => (
                <Link key={item.id} href={active.href(item.id)}
                  className="grid gap-3 px-5 py-3.5 items-center hover:bg-purple-050/40 transition-colors" style={{ gridTemplateColumns: active.cols }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <active.icon className="w-4 h-4 text-purple shrink-0" />
                    <span className="text-sm font-semibold text-ink truncate">{item.title}</span>
                    {item.hasMedia && <Paperclip className="w-3 h-3 text-muted shrink-0" />}
                  </span>
                  {active.kind === "content" && <span className="text-xs text-muted truncate">{item.author}</span>}
                  <span className="text-xs text-muted truncate">{item.county}</span>
                  <span className="text-xs text-muted">{item.when}</span>
                  <ChevronRight className="w-4 h-4 text-muted justify-self-end" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
