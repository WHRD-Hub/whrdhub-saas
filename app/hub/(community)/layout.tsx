import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

/**
 * The community side of the Hub console (posts, stories, resources, CBOs,
 * members). Reporting defenders share the surrounding shell but must not see
 * community moderation, so they are sent to the reporting console instead.
 *
 * This is a route group: the URLs are unchanged (/hub, /hub/posts, …).
 */
export default async function HubCommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.profile?.is_hub_admin) redirect("/hub/reporting");
  return <>{children}</>;
}
