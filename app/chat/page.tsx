import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPageClient } from "./chat-client";

export const metadata = {
  title: "Resource Assistant | WHRD Hub",
};

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return <ChatPageClient />;
}
