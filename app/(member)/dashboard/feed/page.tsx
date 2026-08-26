import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { getFeed } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import { HUB_VIDEOS } from "@/lib/videos";
import { FeedClient } from "@/components/feed/feed-client";

export const metadata = { title: "Community Feed — WHRD Hub" };

export default async function MemberFeedPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [feed, { data: counties }] = await Promise.all([
    getFeed(30, user?.id),
    supabase.from("county_networks").select("name, slug").eq("is_active", true).order("name"),
  ]);

  // Writing to the feed is a member's act; the database enforces the same rule.
  const canPost = !!user && !user.isDeleted && user.canPost;

  // Inside the dashboard shell the sidebar is already the navigation, so the
  // feed's own rails are suppressed by the -mx pull and max-width below.
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
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
        />
      </Suspense>
    </div>
  );
}
