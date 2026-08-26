import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getReportingAccess } from "@/lib/reporting-access";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { ChatFab } from "@/components/reporting/chat-fab";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/hub");
  // A deleted account keeps a valid session until it is signed out; refuse it.
  if (user.isDeleted) redirect("/account-deleted");
  if (user.isBanned) redirect("/account-suspended");

  const access = await getReportingAccess();
  const isHubAdmin = !!user.profile?.is_hub_admin;

  // Two audiences share this console: Hub admins, who manage community content
  // and the reporting response; and reporting defenders, who only triage
  // reports. Anyone who is neither belongs on the member dashboard.
  if (!isHubAdmin && !access?.canTriage) redirect("/dashboard");

  const supabase = await createClient();
  const [
    { count: postsPending },
    { count: blogsPending },
    { count: orgsPending },
    { count: notifCount },
    { count: reportsPending },
    { count: reportsUrgent },
    { count: membersPending },
    { count: suspendedMembers },
  ] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("blogs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending")
      .is("deleted_at", null),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("urgency", "immediate")
      .in("status", ["submitted", "under_review"])
      .is("deleted_at", null),
    supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
  ]);

  const communityNav: NavItem[] = [
    { label: "Overview", href: "/hub", icon: "overview", section: "Community" },
    { label: "Posts", href: "/hub/posts", icon: "posts", badge: postsPending || undefined, section: "Community" },
    { label: "Stories", href: "/hub/blogs", icon: "blogs", badge: blogsPending || undefined, section: "Community" },
    { label: "Resources", href: "/hub/resources", icon: "resources", section: "Community" },
    { label: "CBOs", href: "/hub/organizations", icon: "organisations", badge: orgsPending || undefined, section: "Community" },
    { label: "Members", href: "/hub/members", icon: "members", section: "Community" },
    { label: "Femtorship", href: "/hub/femtorship", icon: "femtorship", section: "Community" },
    {
      label: "Membership requests",
      href: "/dashboard/network",
      icon: "matching",
      badge: membersPending || undefined,
      section: "Community",
    },
    {
      label: "Moderation",
      href: "/hub/moderation",
      icon: "moderation",
      badge: suspendedMembers || undefined,
      section: "Community",
    },
    { label: "Deleted content", href: "/hub/deleted", icon: "deleted", section: "Community" },
    { label: "Deleted accounts", href: "/hub/accounts", icon: "accounts", section: "Community" },
  ];

  // The reporting console. Triage-only accounts see the case-handling pages;
  // full administrators also get the directory, listening and linkage tools.
  const reportingNav: NavItem[] = [
    { label: "Reporting dashboard", href: "/hub/reporting", icon: "triage", section: "Reporting" },
    {
      label: "Reports",
      href: "/hub/reporting/reports",
      icon: "reports",
      badge: reportsUrgent || reportsPending || undefined,
      section: "Reporting",
    },
    { label: "Incident map", href: "/hub/reporting/map", icon: "map", section: "Reporting" },
    ...(access?.canAdminister
      ? ([
          { label: "Support services", href: "/hub/reporting/services", icon: "support", section: "Reporting" },
          { label: "Analytics", href: "/hub/reporting/analytics", icon: "analytics", section: "Reporting" },
          { label: "Referral linkages", href: "/hub/reporting/linkages", icon: "linkages", section: "Reporting" },
          { label: "Online listening", href: "/hub/reporting/listening", icon: "listening", section: "Reporting" },
          { label: "Deleted reports", href: "/hub/reporting/deleted", icon: "deleted", section: "Reporting" },
        ] as NavItem[])
      : []),
  ];

  const nav: NavItem[] = [
    ...(isHubAdmin ? communityNav : []),
    ...(access?.canTriage ? reportingNav : []),
  ];

  return (
    <DashboardShell
      role="admin"
      userName={user.profile?.full_name || "Admin"}
      userRole={isHubAdmin ? "Hub admin" : "Reporting defender"}
      avatarUrl={user.profile?.avatar_url}
      nav={nav}
      title={isHubAdmin ? "Hub Console" : "Reporting Console"}
      notifCount={notifCount ?? 0}
      isAdmin={isHubAdmin}
    >
      {children}
      <ChatFab />
    </DashboardShell>
  );
}
