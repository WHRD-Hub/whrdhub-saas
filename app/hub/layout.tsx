import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // Mentors who sent documents and are waiting to be checked (read with the service role: the table has no admin policy).
  const mentorsWaiting = isHubAdmin
    ? (await createAdminClient().from("mentor_verifications").select("user_id", { count: "exact", head: true }).eq("status", "under_review")).count ?? 0
    : 0;
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

  // The sidebar shows one area at a time. Everyday pages are listed; the rarely
  // used ones are marked secondary and sit under "More". Items of one section
  // stay together so each heading appears once.
  const communityNav: NavItem[] = [
    { label: "Overview", shortLabel: "Hub", href: "/hub", icon: "overview", area: "Community", primary: true },

    // What is waiting on a decision: the group an administrator opens first, so it carries the badges.
    { label: "Posts", href: "/hub/posts", icon: "posts", badge: postsPending || undefined, area: "Community", section: "To review", primary: true },
    { label: "Stories", href: "/hub/blogs", icon: "blogs", badge: blogsPending || undefined, area: "Community", section: "To review" },
    { label: "Membership requests", href: "/dashboard/network", icon: "matching", badge: membersPending || undefined, area: "Community", section: "To review" },
    { label: "Moderation", href: "/hub/moderation", icon: "moderation", badge: suspendedMembers || undefined, area: "Community", section: "To review" },

    { label: "Members", href: "/hub/members", icon: "members", area: "Community", section: "Manage" },
    { label: "CBOs", href: "/hub/organizations", icon: "organisations", badge: orgsPending || undefined, area: "Community", section: "Manage" },
    { label: "Resources", href: "/hub/resources", icon: "resources", area: "Community", section: "Manage" },
    { label: "Femtorship", href: "/hub/femtorship", icon: "femtorship", area: "Community", section: "Manage" },
    { label: "Mentors", href: "/hub/mentors", icon: "members", badge: mentorsWaiting || undefined, area: "Community", section: "Manage" },

    { label: "Deleted content", href: "/hub/deleted", icon: "deleted", area: "Community", secondary: true },
    { label: "Deleted accounts", href: "/hub/accounts", icon: "accounts", area: "Community", secondary: true },
  ];

  // The reporting console. Triage-only accounts see the case-handling pages;
  // full administrators also get the directory, listening and linkage tools.
  const reportingNav: NavItem[] = [
    { label: "Reporting dashboard", shortLabel: "Reporting", href: "/hub/reporting", icon: "triage", area: "Reporting", primary: true },
    { label: "Reports", href: "/hub/reporting/reports", icon: "reports", primary: true, badge: reportsUrgent || reportsPending || undefined, area: "Reporting" },
    ...(access?.canAdminister
      ? ([{ label: "Online listening", href: "/hub/reporting/listening", icon: "listening", area: "Reporting" }] as NavItem[])
      : []),
    { label: "Incident map", href: "/hub/reporting/map", icon: "map", area: "Reporting" },
    { label: "Matching", href: "/hub/reporting/matching", icon: "matchflow", area: "Reporting" },
    ...(access?.canAdminister
      ? ([
          { label: "Support services", href: "/hub/reporting/services", icon: "support", area: "Reporting" },
          { label: "Analytics", href: "/hub/reporting/analytics", icon: "analytics", area: "Reporting", secondary: true },
          { label: "Referral linkages", href: "/hub/reporting/linkages", icon: "linkages", area: "Reporting", secondary: true },
          { label: "Deleted reports", href: "/hub/reporting/deleted", icon: "deleted", area: "Reporting", secondary: true },
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
