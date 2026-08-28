import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Avatar } from "@/components/ui/field";
import { NetworkAvatar } from "@/components/feed/network-avatar";
import { BlogGallery } from "@/components/blog/blog-gallery";
import { createClient } from "@/lib/supabase/server";
import { pageMeta, SITE_DESCRIPTION } from "@/lib/seo";
import { hubFile, hubFileHtml } from "@/lib/file-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: blog } = await supabase
    .from("blogs")
    .select("title, excerpt")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (!blog) return pageMeta({ title: "Story", path: `/blog/${slug}` });
  const desc = (blog.excerpt as string)?.trim() || SITE_DESCRIPTION;
  // The image is supplied automatically by the sibling opengraph-image.tsx.
  return pageMeta({ title: blog.title as string, description: desc, path: `/blog/${slug}`, type: "article" });
}

export default async function BlogReader({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: blog } = await supabase
    .from("blogs")
    .select("id, title, body, cover_image_url, gallery, is_hub, author_id, published_at, created_at, county_networks(name), organizations(name, logo_url)")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!blog) notFound();

  // The story is published by a network; the person who wrote it is credited
  // under it. Same rule as the feed — see the FeedByline note in lib/feed.ts.
  let authorName: string | null = null;
  let authorTitle: string | null = null;
  let avatar: string | null = null;
  if (!blog.is_hub && blog.author_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, username, title, avatar_url")
      .eq("id", blog.author_id)
      .maybeSingle();
    if (p) {
      authorName = (p.full_name as string) || (p.username as string) || "WHRD member";
      authorTitle = (p.title as string) ?? null;
      avatar = (p.avatar_url as string) ?? null;
    }
  }

  const org = Array.isArray(blog.organizations)
    ? blog.organizations[0]
    : (blog.organizations as { name: string; logo_url?: string | null } | null);

  const county = Array.isArray(blog.county_networks)
    ? blog.county_networks[0]?.name
    : (blog.county_networks as { name: string } | null)?.name;
  const date = new Date(blog.published_at ?? blog.created_at).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const networkName = blog.is_hub
    ? "WHRD Hub"
    : (org?.name ?? (county ? `WHRD Hub · ${county}` : "WHRD Hub"));
  const networkLogo = blog.is_hub ? "/main-logo.png" : (org?.logo_url ?? (org ? null : "/main-logo.png"));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> All stories
        </Link>

        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-ink leading-tight">{blog.title}</h1>

        <div className="mt-5 flex items-center gap-3">
          <NetworkAvatar
            name={networkName}
            logoUrl={networkLogo}
            isHub={blog.is_hub || !org}
            size={44}
          />
          <div className="text-sm">
            <p className="font-semibold text-ink">{networkName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {[county, date].filter(Boolean).join(" · ")}
            </p>
            {authorName && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <Avatar name={authorName} src={avatar} size={16} />
                Written by <span className="font-semibold text-ink/80">{authorName}</span>
                {authorTitle ? `, ${authorTitle}` : ""}
              </p>
            )}
          </div>
        </div>

        {blog.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hubFile(blog.cover_image_url)}
            alt=""
            className="mt-6 w-full rounded-2xl border border-line object-cover max-h-[420px]"
          />
        )}

        {/(<\/?[a-z][\s\S]*>)/i.test(blog.body as string) ? (
          <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: hubFileHtml(blog.body as string) }} />
        ) : (
          <div className="blog-content mt-8">
            {(blog.body as string).split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-wrap">{para}</p>
            ))}
          </div>
        )}

        <BlogGallery images={Array.isArray(blog.gallery) ? (blog.gallery as string[]) : []} />
      </article>
      <SiteFooter />
    </div>
  );
}
