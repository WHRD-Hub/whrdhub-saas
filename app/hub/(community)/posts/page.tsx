import { Pin, Paperclip, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContentTabs } from "@/components/hub/content-tabs";
import { DataTable, type Column } from "@/components/hub/data-table";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { CONTENT_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Posts — WHRD Hub" };

const VALID = ["pending", "approved", "rejected", "all"];

interface Row {
  id: string; body: string; author: string; county: string; status: string; created_at: string; pinned: boolean; hasMedia: boolean;
}

export default async function HubPosts({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active = VALID.includes(status ?? "") ? (status as string) : "pending";
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("id, author_id, body, image_urls, media, is_hub, pinned, status, created_at, county_networks(name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (active !== "all") query = query.eq("status", active);
  const { data: posts } = await query;

  const counts: Record<string, number> = {};
  for (const s of ["pending", "approved", "rejected"]) {
    const { count } = await supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", s);
    counts[s] = count ?? 0;
  }

  const ids = Array.from(new Set((posts ?? []).map((p) => p.author_id).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
    for (const p of data ?? []) names.set(p.id as string, (p.full_name as string) || (p.username as string) || "WHRD member");
  }
  const countyName = (v: unknown) => (Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name);

  const rows: Row[] = (posts ?? []).map((p) => ({
    id: p.id as string,
    body: (p.body as string)?.slice(0, 90) || "Untitled post",
    author: p.is_hub ? "WHRD Hub" : names.get(p.author_id!) ?? "WHRD member",
    county: countyName(p.county_networks) ?? "—",
    status: p.status as string,
    created_at: p.created_at as string,
    pinned: p.pinned as boolean,
    hasMedia: ((p.media as unknown[])?.length ?? 0) > 0 || ((p.image_urls as unknown[])?.length ?? 0) > 0,
  }));

  const columns: Column<Row>[] = [
    {
      key: "post", header: "Post", width: "1.8fr",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          {r.pinned && <Pin className="w-3.5 h-3.5 text-purple shrink-0" />}
          <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
          <span className="text-sm text-ink truncate font-medium">{r.body}</span>
          {r.hasMedia && <Paperclip className="w-3.5 h-3.5 text-muted shrink-0" />}
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
        <h1 className="text-2xl font-black text-ink">Posts</h1>
        <p className="text-sm text-muted mt-1">Open a post to review, edit, and publish it. Approve, decline, or pin from the detail view.</p>
      </div>

      <ContentTabs active={active} counts={counts} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/hub/posts/${r.id}`}
        emptyIcon={FileText}
        emptyTitle={active === "approved" ? "No published posts yet" : "No posts here"}
        emptySubtitle={active === "approved" ? "Posts appear here once you approve them. Member posts published so far may be stories, which live under the Stories tab." : "Nothing matches this filter right now."}
      />
    </div>
  );
}
