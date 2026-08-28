import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MapPin, Heart, ArrowUpRight, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LandingModeSwitcher } from "@/components/landing/mode-switcher";
import { FeedCard } from "@/components/feed/feed-card";
import { VideoCard } from "@/components/feed/video-card";
import { getFeed } from "@/lib/feed";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { SITE, PILLARS, LAWLOR_QUOTE } from "@/lib/data";
import { latestVideoId, HUB_VIDEOS } from "@/lib/videos";
import { hubFile } from "@/lib/file-url";

const IMG = {
  // Same photo used as the hero on the About page, per request.
  hero: "https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg",
  roundtable: "https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg",
  strategy: "https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg",
  training: "https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg",
  artwork: "https://whrdhub.org/wp-content/uploads/2025/05/WHRDHUB-Artwork-4.png",
};

const COUNTIES = [
  { name: "Bomet", slug: "bomet" }, { name: "Kisumu", slug: "kisumu" },
  { name: "Kitui", slug: "kitui" }, { name: "Marsabit", slug: "marsabit" },
  { name: "Meru", slug: "meru" }, { name: "Mombasa", slug: "mombasa" },
  { name: "Nairobi", slug: "nairobi" }, { name: "Nakuru", slug: "nakuru" },
];

const PILLAR_TINT = ["bg-purple-050", "bg-magenta-050", "bg-cyan-050", "bg-purple-050", "bg-magenta-050", "bg-cyan-050"];

export default async function LandingPage() {
  const user = await getCurrentUser();

  // A signed-in member came here to use the Hub, not to read the pitch. Sending
  // them straight to their dashboard removes the second click that made signing
  // in feel like it had not worked. Marketing stays reachable at /about and
  // through the footer, and anyone signed out still lands here.
  if (user && !user.profile?.account_deleted_at) {
    redirect(user.profile?.is_hub_admin ? "/hub" : "/dashboard");
  }

  const feed = await getFeed(20, user?.id);

  const supabase = await createClient();
  const { data: stories } = await supabase
    .from("blogs")
    .select("title, slug, excerpt, cover_image_url, published_at")
    .eq("status", "approved")
    .order("published_at", { ascending: false })
    .limit(3);

  // Desktop split-view feed column: posts/blogs interleaved with videos.
  const otherVideos = HUB_VIDEOS.slice(1);
  const stream: ({ t: "post"; k: string; item: (typeof feed)[number] } | { t: "video"; k: string; id: string })[] = [];
  let vi = 0;
  feed.forEach((item, i) => {
    stream.push({ t: "post", k: `${item.kind}-${item.id}`, item });
    if (i % 2 === 1 && vi < otherVideos.length) { stream.push({ t: "video", k: `v-${otherVideos[vi]}`, id: otherVideos[vi] }); vi += 1; }
  });
  while (vi < otherVideos.length) { stream.push({ t: "video", k: `v-${otherVideos[vi]}`, id: otherVideos[vi] }); vi += 1; }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <LandingModeSwitcher feed={feed} videos={HUB_VIDEOS} signedIn={!!user}>
      {/* ── HERO: official content (left) + feed column (right, desktop) ── */}
      <section className="relative overflow-hidden brand-wash border-b border-line">
        <div className="relative max-w-[1520px] mx-auto px-4 sm:px-6 py-12 lg:py-14 grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] gap-10 lg:gap-14 items-start">
          {/* LEFT — official content */}
          <div className="lg:pt-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface border border-line px-3.5 py-1.5 text-xs font-bold text-purple">
              <Sparkles className="w-3.5 h-3.5" /> The movement, now online
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.03] text-ink">
              A home for women <span className="text-purple">human rights defenders</span> across Kenya &amp; Beyond
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted leading-relaxed max-w-xl">{SITE.mission}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-xl bg-purple text-white px-5 sm:px-6 py-3.5 text-sm font-bold hover:bg-purple-600 transition shadow-sm">
                {user ? "Go to your dashboard" : "Join the Hub"} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/feed" className="inline-flex items-center gap-2 rounded-xl bg-magenta text-white px-5 sm:px-6 py-3.5 text-sm font-bold hover:brightness-95 transition shadow-sm">
                <Sparkles className="w-4 h-4" /> Live feed
              </Link>
            </div>

            <div className="mt-8 rounded-3xl overflow-hidden border border-line shadow-xl shadow-purple/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.hero} alt="Women human rights defenders" className="w-full h-64 sm:h-80 object-cover" />
            </div>
          </div>

          {/* RIGHT — community feed (desktop only; mobile uses the toggle) */}
          <div className="hidden lg:block lg:sticky lg:top-[4.75rem]">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Community feed</p>
              <Link href="/feed" className="text-xs font-semibold text-purple hover:text-purple-700">Open feed →</Link>
            </div>
            <div className="rounded-2xl border border-line bg-surface overflow-hidden divide-y divide-line max-h-[calc(100vh-7rem)] overflow-y-auto feed-scroll">
              <VideoCard id={latestVideoId} pinned />
              {stream.map((s) =>
                s.t === "post" ? (
                  <FeedCard key={s.k} item={s.item} signedIn={!!user} />
                ) : (
                  <VideoCard key={s.k} id={s.id} />
                ),
              )}
              <Link href="/feed" className="block text-center text-xs font-semibold text-purple py-3 hover:text-purple-700">
                Open full feed →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ───────────────────────────────────────────── */}
      <section className="bg-purple text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-3 gap-8 text-center">
          {[
            { k: "9", v: "County networks" },
            { k: "6", v: "Pillars of protection" },
            { k: "1", v: "Shared movement" },
          ].map((s) => (
            <div key={s.v}>
              <p className="text-4xl font-black">{s.k}</p>
              <p className="text-sm text-white/80 mt-1">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PILLARS ──────────────────────────────────────────────── */}
      <section id="work" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-magenta">What we focus on</p>
          <h2 className="mt-2 text-3xl font-black text-ink">Six pillars hold the work together</h2>
          <p className="mt-3 text-muted">From safety and wellbeing to livelihoods and femtorship, our work wraps around the whole defender.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <div key={p.title} className={`rounded-2xl border border-line p-6 ${PILLAR_TINT[i % PILLAR_TINT.length]}`}>
              <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center text-purple font-black">{i + 1}</div>
              <h3 className="mt-4 font-bold text-ink text-lg">{p.title}</h3>
              <p className="mt-1.5 text-sm text-ink/70 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
        <Link href="/our-work" className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-purple hover:text-magenta">
          Explore our work <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── COUNTY NETWORKS ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-purple">Our counties</p>
            <h2 className="mt-2 text-3xl font-black text-ink">Networks close to home</h2>
            <p className="mt-3 text-muted">These communities have always organised offline. Now they have an online home too.</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {COUNTIES.map((c, i) => (
            <Link key={c.slug} href={`/counties/${c.slug}`} className="group relative overflow-hidden rounded-2xl border border-line p-6 h-32 flex flex-col justify-end hover:shadow-md transition-shadow"
              style={{ background: i % 3 === 0 ? "var(--purple-050)" : i % 3 === 1 ? "var(--magenta-050)" : "var(--cyan-050)" }}>
              <MapPin className="absolute top-4 right-4 w-5 h-5 text-ink/30 group-hover:text-purple transition-colors" />
              <p className="font-black text-ink text-lg">{c.name}</p>
              <p className="text-xs text-ink/60 flex items-center gap-1">Explore network <ArrowUpRight className="w-3 h-3" /></p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── STORIES ──────────────────────────────────────────────── */}
      {stories && stories.length > 0 && (
        <section className="bg-paper border-y border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-magenta">Stories</p>
                <h2 className="mt-2 text-3xl font-black text-ink">Voices from the movement</h2>
              </div>
              <Link href="/blog" className="text-sm font-bold text-purple hover:text-magenta inline-flex items-center gap-1.5">All stories <ArrowRight className="w-4 h-4" /></Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {stories.map((s) => (
                <Link key={s.slug} href={`/blog/${s.slug}`} className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow">
                  {s.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hubFile(s.cover_image_url)} alt="" className="h-44 w-full object-cover" />
                  ) : <div className="h-44 brand-wash" />}
                  <div className="p-5">
                    <h3 className="font-bold text-ink leading-snug group-hover:text-purple transition-colors">{s.title}</h3>
                    {s.excerpt && <p className="mt-1.5 text-sm text-muted line-clamp-2">{s.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── VISION + QUOTE ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-magenta text-white p-8 lg:p-10">
          <Heart className="w-8 h-8 text-white/60" />
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-white/85">Our vision</p>
          <p className="mt-2 text-2xl font-bold leading-snug">{SITE.vision}</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-8 lg:p-10">
          <p className="text-lg text-ink font-medium leading-relaxed">&ldquo;{LAWLOR_QUOTE.text}&rdquo;</p>
          <p className="mt-4 text-sm font-bold text-ink">{LAWLOR_QUOTE.who}</p>
          <p className="text-xs text-muted">{LAWLOR_QUOTE.role}</p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-purple text-white p-10 lg:p-14 text-center">
          <div className="absolute inset-0 opacity-10 bg-no-repeat bg-center bg-contain" style={{ backgroundImage: `url(${IMG.artwork})` }} aria-hidden />
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-black">Add your voice to the movement</h2>
            <p className="mt-3 text-white/80 max-w-xl mx-auto">Join your county network, share your work, and grow through femtorship.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={user ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-700 px-6 py-3.5 text-sm font-bold hover:bg-white/90">
                {user ? "Go to dashboard" : "Join the Hub"} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/feed" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold hover:bg-white/10">
                <Sparkles className="w-4 h-4" /> Live feed
              </Link>
            </div>
          </div>
        </div>
      </section>
      </LandingModeSwitcher>

      <SiteFooter />
    </div>
  );
}
