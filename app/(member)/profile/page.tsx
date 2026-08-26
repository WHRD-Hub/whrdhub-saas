import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/profile-client";

export const metadata = { title: "Profile — WHRD Hub" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const uid = user!.id;

  const [{ data: fem }, { data: posts }, { data: blogs }, { data: reactions }, { data: counties }] =
    await Promise.all([
      supabase.from("mentorship_profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("posts").select("id, body, status, created_at, deleted_at").eq("author_id", uid).order("created_at", { ascending: false }),
      supabase.from("blogs").select("id, title, slug, status, created_at, deleted_at").eq("author_id", uid).order("created_at", { ascending: false }),
      supabase.from("post_reactions").select("post_id, posts(id, body, is_hub, status)").eq("user_id", uid).limit(50),
      supabase.from("county_networks").select("id, name, is_active").order("is_active", { ascending: false }).order("name"),
    ]);

  const reactedPosts = (reactions ?? [])
    .map((r) => (Array.isArray(r.posts) ? r.posts[0] : r.posts))
    .filter(Boolean) as { id: string; body: string; is_hub: boolean; status: string }[];

  return (
    <ProfileClient
      profile={{
        full_name: user?.profile?.full_name ?? "",
        title: user?.profile?.title ?? "",
        bio: user?.profile?.bio ?? "",
        email: user?.email ?? "",
        county_network_id: user?.profile?.county_network_id ?? "",
      }}
      femtorship={fem ?? null}
      counties={counties ?? []}
      posts={posts ?? []}
      blogs={blogs ?? []}
      reactedPosts={reactedPosts}
      isAdmin={!!user?.profile?.is_hub_admin}
    />
  );
}
