import { createClient } from "@/lib/supabase/server";
import { NotificationsView, type Notif } from "@/components/notifications/notifications-view";

export const metadata = { title: "Notifications — WHRD Hub" };

export default async function HubNotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(50);
  return <NotificationsView notifications={(data ?? []) as Notif[]} />;
}
