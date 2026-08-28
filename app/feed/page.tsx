import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { FeedClient } from "@/components/feed/feed-client";
import { getFeed } from "@/lib/feed";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { HUB_VIDEOS } from "@/lib/videos";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Community Feed",
  description:
    "Verified updates, stories, and video from women human rights defenders and the Hub.",
  path: "/feed",
});

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; county?: string }>;
}) {
  const sp = await searchParams;
  const filter = { mine: sp.mine === "1", countySlug: sp.county };
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [feed, { data: counties }] = await Promise.all([
    getFeed(30, user?.id, filter),
    supabase
      .from("county_networks")
      .select("name, slug")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Writing to the feed is a member's act: an approved place in a county
  // network's organisation, or Hub staff. Everyone else can read and support.
  // The database enforces the same rule; this only decides what the UI offers.
  const canPost = !!user && !user.isDeleted && user.canPost;

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <Suspense fallback={null}>
        <FeedClient
          feed={feed}
          videos={HUB_VIDEOS}
          signedIn={!!user}
          isHubAdmin={!!user?.profile?.is_hub_admin}
          canPost={canPost}
          userName={user?.profile?.full_name ?? user?.profile?.username ?? null}
          avatarUrl={user?.profile?.avatar_url}
          counties={(counties ?? []) as { name: string; slug: string }[]}
          filter={filter}
        />
      </Suspense>
    </div>
  );
}
