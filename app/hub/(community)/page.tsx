import Link from "next/link";
import { FileText, BookOpen, Building2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { TrendArea } from "@/components/hub/charts";
import { ReviewInbox, type InboxItem } from "@/components/hub/review-inbox";
import { WelcomeHeader } from "@/components/hub/welcome-header";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Hub overview — WHRD Hub" };

interface Overview {
  members: number; onboarded: number; organizations: number; orgs_pending: number;
  posts_pending: number; blogs_pending: number; posts_live: number; blogs_live: number;
  posts_declined: number; blogs_declined: number; counties_active: number; reports_total: number;
}

async function names(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
  for (const p of data ?? []) map.set(p.id as string, (p.full_name as string) || (p.username as string) || "WHRD member");
  return map;
}

export default async function HubOverview() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const firstName = (user?.profile?.full_name || "there").split(/\s+/)[0];

  const [
    { data: overviewData }, { data: subs }, { data: growth },
    { data: pPosts }, { data: pBlogs }, { data: pOrgs },
  ] = await Promise.all([
    supabase.rpc("hub_overview"),
    supabase.rpc("hub_submissions_timeseries", { days: 30 }),
    supabase.rpc("hub_member_growth", { days: 30 }),
    supabase.from("posts").select("id, author_id, body, media, image_urls, created_at, county_networks(name)").eq("status", "pending").order("created_at", { ascending: false }).limit(8),
    supabase.from("blogs").select("id, author_id, title, cover_image_url, created_at, county_networks(name)").eq("status", "pending").order("created_at", { ascending: false }).limit(8),
    supabase.from("organizations").select("id, name, created_at, county_networks(name)").eq("verification_status", "pending").order("created_at", { ascending: false }).limit(8),
  ]);

  const o = (overviewData as Overview) ?? ({} as Overview);
  const subsRows = (subs as { day: string; posts: number; blogs: number }[]) ?? [];
  const growthRows = (growth as { day: string; joins: number }[]) ?? [];
  const subsSeries = subsRows.map((r) => ({ label: r.day, value: Number(r.posts) + Number(r.blogs) }));
  const growthSeries = growthRows.map((r) => ({ label: r.day, value: Number(r.joins) }));

  const orgsVerified = (o.organizations ?? 0) - (o.orgs_pending ?? 0);

  // Inbox
  const authorIds = [...(pPosts ?? []).map((p) => p.author_id), ...(pBlogs ?? []).map((b) => b.author_id)].filter(Boolean) as string[];
  const nameMap = await names(supabase, Array.from(new Set(authorIds)));
  const county = (v: unknown) => (Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name);

  const inboxPosts: InboxItem[] = (pPosts ?? []).map((p) => ({
    id: p.id as string, title: (p.body as string)?.slice(0, 70) || "Untitled post",
    author: nameMap.get(p.author_id as string) ?? "WHRD member", county: county(p.county_networks) ?? "—",
    when: timeAgo(p.created_at as string),
    hasMedia: ((p.media as unknown[])?.length ?? 0) > 0 || ((p.image_urls as unknown[])?.length ?? 0) > 0,
  }));
  const inboxBlogs: InboxItem[] = (pBlogs ?? []).map((b) => ({
    id: b.id as string, title: (b.title as string) || "Untitled story",
    author: nameMap.get(b.author_id as string) ?? "WHRD member", county: county(b.county_networks) ?? "—",
    when: timeAgo(b.created_at as string), hasMedia: !!b.cover_image_url,
  }));
  const inboxOrgs: InboxItem[] = (pOrgs ?? []).map((org) => ({
    id: org.id as string, title: (org.name as string) || "Organisation",
    author: "", county: county(org.county_networks) ?? "No county", when: timeAgo(org.created_at as string),
  }));

  // Management cards — pastel surface, harmonious single-tone figures.
  const cards = [
    { label: "Posts", href: "/hub/posts", icon: FileText, primary: o.posts_live ?? 0, primaryLabel: "Published", pending: o.posts_pending ?? 0, bg: "bg-cyan-050", ic: "text-cyan-700" },
    { label: "Stories", href: "/hub/blogs", icon: BookOpen, primary: o.blogs_live ?? 0, primaryLabel: "Published", pending: o.blogs_pending ?? 0, bg: "bg-purple-050", ic: "text-purple" },
    { label: "CBOs", href: "/hub/organizations", icon: Building2, primary: orgsVerified, primaryLabel: "Verified", pending: o.orgs_pending ?? 0, bg: "bg-magenta-050", ic: "text-magenta-700" },
    { label: "Members", href: "/hub/members", icon: Users, primary: o.onboarded ?? 0, primaryLabel: "Onboarded", pending: 0, sub: `${o.counties_active ?? 0} counties`, bg: "bg-emerald-50", ic: "text-emerald-700" },
  ];

  return (
    <div className="space-y-6">
      <WelcomeHeader name={firstName} />

      {/* Management console */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted mb-3">Management console</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className={`rounded-[10px] ${c.bg} p-5 hover:shadow-md transition-shadow block`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-[10px] grid place-items-center bg-white ${c.ic}`}><c.icon className="w-5 h-5" /></div>
                <p className="font-bold text-ink">{c.label}</p>
              </div>
              <p className="mt-4 text-3xl font-black text-ink leading-none">{c.primary}</p>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <span className="text-ink/55">{c.primaryLabel}</span>
                {c.pending > 0 && <span className="text-amber-700 font-bold">· {c.pending} pending</span>}
                {c.sub && <span className="text-ink/45">· {c.sub}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Needs-attention table */}
      <ReviewInbox posts={inboxPosts} cbos={inboxOrgs} blogs={inboxBlogs} />

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-[10px] border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <div><h2 className="font-black text-ink">Submissions</h2><p className="text-xs text-muted">posts + stories, last 30 days</p></div>
            <span className="text-3xl font-black text-purple">{subsSeries.reduce((a, b) => a + b.value, 0)}</span>
          </div>
          <TrendArea data={subsSeries} color="#734e9e" suffix="items" />
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <div><h2 className="font-black text-ink">New members</h2><p className="text-xs text-muted">joins per day, last 30 days</p></div>
            <span className="text-3xl font-black text-cyan-700">{growthSeries.reduce((a, b) => a + b.value, 0)}</span>
          </div>
          <TrendArea data={growthSeries} color="#12718f" suffix="joined" />
        </div>
      </div>
    </div>
  );
}
