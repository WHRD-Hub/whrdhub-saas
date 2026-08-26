import { Pin, Image as ImageIcon, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContentTabs } from "@/components/hub/content-tabs";
import { DataTable, type Column } from "@/components/hub/data-table";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { CONTENT_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Stories — WHRD Hub" };

const VALID = ["pending", "approved", "rejected", "all"];

interface Row {
  id: string; title: string; author: string; county: string; status: string; created_at: string; pinned: boolean; hasCover: boolean;
}

export default async function HubBlogs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active = VALID.includes(status ?? "") ? (status as string) : "pending";
  const supabase = await createClient();

  let query = supabase
    .from("blogs")
    .select("id, author_id, title, cover_image_url, is_hub, pinned, status, created_at, county_networks(name)")
    // Deleted stories live in /hub/deleted, not in the moderation list.
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (active !== "all") query = query.eq("status", active);
  const { data: blogs } = await query;

  const counts: Record<string, number> = {};
  for (const s of ["pending", "approved", "rejected"]) {
    const { count } = await supabase
      .from("blogs")
      .select("id", { count: "exact", head: true })
      .eq("status", s)
      .is("deleted_at", null);
    counts[s] = count ?? 0;
  }

  const ids = Array.from(new Set((blogs ?? []).map((b) => b.author_id).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
    for (const p of data ?? []) names.set(p.id as string, (p.full_name as string) || (p.username as string) || "WHRD member");
  }
  const countyName = (v: unknown) => (Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name);

  const rows: Row[] = (blogs ?? []).map((b) => ({
    id: b.id as string,
    title: (b.title as string) || "Untitled story",
    author: b.is_hub ? "WHRD Hub" : names.get(b.author_id!) ?? "WHRD member",
    county: countyName(b.county_networks) ?? "—",
    status: b.status as string,
    created_at: b.created_at as string,
    pinned: b.pinned as boolean,
    hasCover: !!b.cover_image_url,
  }));

  const columns: Column<Row>[] = [
    {
      key: "story", header: "Story", width: "1.8fr",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          {r.pinned && <Pin className="w-3.5 h-3.5 text-purple shrink-0" />}
          <BookOpen className="w-4 h-4 text-purple shrink-0" />
          <span className="text-sm text-ink truncate font-semibold">{r.title}</span>
          {r.hasCover && <ImageIcon className="w-3.5 h-3.5 text-muted shrink-0" />}
        </div>
      ),
    },
    {
      key: "author", header: "Author", width: "180px",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-0"><Avatar name={r.author} size={26} /><span className="text-xs text-muted truncate">{r.author} · {r.county}</span></div>
      ),
    },
    { key: "status", header: "Status", width: "150px", cell: (r) => <Pill tone={CONTENT_STATUS_META[r.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[r.status]?.label ?? r.status}</Pill> },
    { key: "date", header: "Date", width: "110px", cell: (r) => <span className="text-xs text-muted">{timeAgo(r.created_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink">Stories</h1>
        <p className="text-sm text-muted mt-1">Open a story to review it in the editor, make changes, and publish. You can also edit stories already live.</p>
      </div>

      <ContentTabs active={active} counts={counts} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/hub/blogs/${r.id}`}
        emptyIcon={BookOpen}
        emptyTitle="No stories here"
        emptySubtitle="Nothing matches this filter right now."
      />
    </div>
  );
}
