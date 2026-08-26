import { redirect } from "next/navigation";
import { getReportingAccess } from "@/lib/reporting-access";

/**
 * The reporting console. Open to Hub admins and to reporting defenders; the
 * per-page checks the reporting platform used to carry now live here, so every
 * route under /hub/reporting is gated in one place.
 *
 * RLS remains the real boundary — this only decides what the UI offers.
 */
export default async function ReportingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getReportingAccess();
  if (!access) redirect("/login?next=/hub/reporting");
  if (!access.canTriage) redirect("/dashboard");
  return <>{children}</>;
}
