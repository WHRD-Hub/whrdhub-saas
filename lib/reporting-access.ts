import { createClient } from "@/lib/supabase/server";

/**
 * Who may see the reporting console.
 *
 * Two role systems used to live side by side: the reporting platform kept
 * `profiles.user_type` ('reporter' | 'defender' | 'admin') and the Hub kept
 * `profiles.is_hub_admin`. Now that both dashboards are one app, this is the
 * single place that decides. A Hub admin is always a reporting admin; a
 * reporting `defender` gets triage access but not destructive admin actions.
 */
export type ReportingRole = "admin" | "defender" | null;

export interface ReportingAccess {
  userId: string;
  role: ReportingRole;
  /** May open the reporting console at all. */
  canTriage: boolean;
  /** May verify, assign services, manage the service directory, run listening. */
  canAdminister: boolean;
}

export async function getReportingAccess(): Promise<ReportingAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, is_hub_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isHubAdmin = !!profile?.is_hub_admin;
  const userType = (profile?.user_type as string | null) ?? null;

  const role: ReportingRole =
    isHubAdmin || userType === "admin"
      ? "admin"
      : userType === "defender"
        ? "defender"
        : null;

  return {
    userId: user.id,
    role,
    canTriage: role === "admin" || role === "defender",
    canAdminister: role === "admin",
  };
}

/** Server-action guard: returns the user id for an administrator, else null. */
export async function requireReportingAdmin(): Promise<string | null> {
  const access = await getReportingAccess();
  return access?.canAdminister ? access.userId : null;
}

/** Server-action guard: returns the user id for anyone who may triage. */
export async function requireReportingTriage(): Promise<string | null> {
  const access = await getReportingAccess();
  return access?.canTriage ? access.userId : null;
}
