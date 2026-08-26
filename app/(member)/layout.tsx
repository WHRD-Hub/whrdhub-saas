import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getReportingAccess } from "@/lib/reporting-access";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { ChatFab } from "@/components/reporting/chat-fab";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  // Accounts created by the report form are credentialed but anonymous: they
  // have no Hub community profile and must not be pushed through member
  // onboarding. They keep a reports-only dashboard.
  const reporterOnly = user.isReporterOnly;
  if (!reporterOnly && !user.profile?.hub_onboarded) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: reports }, { count: notifCount }] = await Promise.all([
    supabase.from("reports").select("status").eq("user_id", user.id),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
  ]);
  const actioned = (reports ?? []).filter((r) => r.status && r.status !== "submitted").length;

  const nav: NavItem[] = reporterOnly
    ? [
        { label: "My Reports", href: "/dashboard/reports", icon: "reports", badge: actioned || undefined },
        { label: "Profile", href: "/profile", icon: "profile" },
      ]
    : [
        { label: "Overview", href: "/dashboard", icon: "overview" },
        { label: "Community Feed", href: "/dashboard/feed", icon: "feed" },
        { label: "Femtorship", href: "/mentorship", icon: "femtorship" },
        { label: "My Reports", href: "/dashboard/reports", icon: "reports", badge: actioned || undefined },
        { label: "Profile", href: "/profile", icon: "profile" },
      ];

  // Hub admins and reporting defenders get the console switch in the user menu.
  const access = await getReportingAccess();

  return (
    <DashboardShell
      role="member"
      userName={user.profile?.full_name || user.profile?.username || user.email?.split("@")[0] || "there"}
      userRole={
        reporterOnly
          ? "Reporter"
          : (user.membership?.organizations?.name ?? "Member")
      }
      avatarUrl={user.profile?.avatar_url}
      nav={nav}
      title={reporterOnly ? "My Reports" : "Overview"}
      notifCount={notifCount ?? 0}
      isAdmin={!!user.profile?.is_hub_admin || !!access?.canTriage}
    >
      {children}
      <ChatFab />
    </DashboardShell>
  );
}
