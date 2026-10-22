import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { OnboardingWizard } from "./onboarding-client";
import { loadCountyNetworks } from "@/lib/county-networks";

export const metadata = { title: "Complete your profile — WHRD Hub" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.profile?.hub_onboarded) redirect("/dashboard");

  const supabase = await createClient();
  const [counties, { data: orgs }] = await Promise.all([
    loadCountyNetworks(),
    supabase
      .from("organizations")
      .select("id, name, county_network_id, verification_status")
      .order("name"),
  ]);

  return (
    <OnboardingWizard
      defaultName={user.profile?.full_name ?? user.email?.split("@")[0] ?? ""}
      counties={counties}
      organizations={orgs ?? []}
    />
  );
}
