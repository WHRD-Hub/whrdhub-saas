import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { pageMeta } from "@/lib/seo";
import { hubFile } from "@/lib/file-url";

export const metadata = pageMeta({
  title: "Stories",
  description: "Stories, updates, and record keeping from women human rights defenders across Kenya.",
  path: "/blog",
});

export default async function BlogIndex() {
  const supabase = await createClient();
  const { data: blogs } = await supabase
    .from("blogs")
    .select("id, title, slug, excerpt, cover_image_url, is_hub, published_at, created_at, county_networks(name)")
    .eq("status", "approved")
    .order("published_at", { ascending: false });

  const list = blogs ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-magenta flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Stories
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink">Voices from the movement</h1>
          <p className="mt-2 text-muted max-w-2xl">
            Long-form stories and updates from defenders and county networks. Every story is reviewed
            by the Hub before it is published.
          </p>
        </header>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
            No stories published yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {list.map((b) => {
              const county = Array.isArray(b.county_networks)
                ? b.county_networks[0]?.name
                : (b.county_networks as { name: string } | null)?.name;
              return (
                <Link
                  key={b.id}
                  href={`/blog/${b.slug}`}
                  className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow"
                >
                  {b.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hubFile(b.cover_image_url)} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="h-40 w-full brand-wash" />
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {b.is_hub && <span className="font-semibold text-purple">WHRD Hub</span>}
                      {county && <span>{county}</span>}
                      <span>{timeAgo(b.published_at ?? b.created_at)}</span>
                    </div>
                    <h2 className="mt-1.5 font-bold text-ink leading-snug group-hover:text-purple transition-colors">
                      {b.title}
                    </h2>
                    {b.excerpt && <p className="mt-1.5 text-sm text-muted line-clamp-3">{b.excerpt}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
