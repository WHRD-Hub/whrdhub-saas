import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { ContentEditor } from "@/components/hub/content-editor";
import { CONTENT_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Review story — WHRD Hub" };

export default async function BlogDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: blog } = await supabase
    .from("blogs")
    .select("id, author_id, title, excerpt, body, cover_image_url, is_hub, pinned, status, created_at, county_networks(name)")
    .eq("id", id)
    .maybeSingle();
  if (!blog) notFound();

  let authorName = blog.is_hub ? "WHRD Hub" : "WHRD member";
  let authorAvatar: string | null = null;
  if (blog.author_id && !blog.is_hub) {
    const { data: p } = await supabase.from("profiles").select("full_name, username, avatar_url").eq("id", blog.author_id).maybeSingle();
    if (p) { authorName = (p.full_name as string) || (p.username as string) || "WHRD member"; authorAvatar = (p.avatar_url as string) ?? null; }
  }
  const county = Array.isArray(blog.county_networks) ? blog.county_networks[0]?.name : (blog.county_networks as { name: string } | null)?.name;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/hub/blogs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" /> Stories</Link>

      <div className="rounded-xl border border-line bg-surface p-5 flex items-center gap-3">
        <Avatar name={authorName} src={authorAvatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">{authorName}</p>
          <p className="text-xs text-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> {county ?? "No county"} · submitted {timeAgo(blog.created_at as string)}</p>
        </div>
        <Pill tone={CONTENT_STATUS_META[blog.status as string]?.tone ?? "slate"}>{CONTENT_STATUS_META[blog.status as string]?.label ?? blog.status}</Pill>
      </div>

      <ContentEditor
        kind="blog"
        id={blog.id as string}
        status={blog.status as string}
        pinned={blog.pinned as boolean}
        initial={{ title: (blog.title as string) ?? "", excerpt: (blog.excerpt as string) ?? "", body: (blog.body as string) ?? "", cover: (blog.cover_image_url as string) ?? null }}
      />
    </div>
  );
}
