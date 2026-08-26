import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { ContentEditor } from "@/components/hub/content-editor";
import { CONTENT_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";
import type { MediaItem } from "@/components/composer/media-uploader";

export const metadata = { title: "Review post — WHRD Hub" };

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id, body, image_urls, media, is_hub, pinned, status, created_at, county_networks(name)")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  let authorName = post.is_hub ? "WHRD Hub" : "WHRD member";
  let authorAvatar: string | null = null;
  if (post.author_id && !post.is_hub) {
    const { data: p } = await supabase.from("profiles").select("full_name, username, avatar_url").eq("id", post.author_id).maybeSingle();
    if (p) { authorName = (p.full_name as string) || (p.username as string) || "WHRD member"; authorAvatar = (p.avatar_url as string) ?? null; }
  }
  const county = Array.isArray(post.county_networks) ? post.county_networks[0]?.name : (post.county_networks as { name: string } | null)?.name;

  // Combine legacy image_urls into media for preview.
  const media: MediaItem[] = [
    ...((post.media as MediaItem[]) ?? []),
    ...((post.image_urls as string[]) ?? []).filter((u) => !((post.media as MediaItem[]) ?? []).some((m) => m.url === u)).map((u) => ({ type: "image" as const, url: u, name: "image" })),
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/hub/posts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" /> Posts</Link>

      <div className="rounded-xl border border-line bg-surface p-5 flex items-center gap-3">
        <Avatar name={authorName} src={authorAvatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">{authorName}</p>
          <p className="text-xs text-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> {county ?? "No county"} · submitted {timeAgo(post.created_at as string)}</p>
        </div>
        <Pill tone={CONTENT_STATUS_META[post.status as string]?.tone ?? "slate"}>{CONTENT_STATUS_META[post.status as string]?.label ?? post.status}</Pill>
      </div>

      <ContentEditor kind="post" id={post.id as string} status={post.status as string} pinned={post.pinned as boolean} initial={{ body: (post.body as string) ?? "" }} media={media} />
    </div>
  );
}
