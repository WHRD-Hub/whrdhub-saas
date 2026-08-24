import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/hub");
  if (!user.profile?.is_hub_admin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ count: postsPending }, { count: blogsPending }, { count: orgsPending }, { count: notifCount }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("blogs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
  ]);

  const nav: NavItem[] = [
    { label: "Overview", href: "/hub", icon: "overview" },
    { label: "Posts", href: "/hub/posts", icon: "posts", badge: postsPending || undefined },
    { label: "Stories", href: "/hub/blogs", icon: "blogs", badge: blogsPending || undefined },
    { label: "Resources", href: "/hub/resources", icon: "resources" },
    { label: "CBOs", href: "/hub/organizations", icon: "organisations", badge: orgsPending || undefined },
    { label: "Members", href: "/hub/members", icon: "members" },
  ];

  return (
    <DashboardShell role="admin" userName={user.profile?.full_name || "Admin"} userRole="Hub admin" avatarUrl={user.profile?.avatar_url} nav={nav} title="Hub Console" notifCount={notifCount ?? 0} isAdmin>
      {children}
    </DashboardShell>
  );
}
