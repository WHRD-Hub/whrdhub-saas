import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { JoinButton } from "@/components/network/join-button";

export const metadata = {
  title: "Networks — WHRD Hub",
  description: "Women human rights defender organisations and CBOs across Kenya's county networks.",
};

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, description, verification_status, county_networks(name)")
    .eq("verification_status", "verified")
    .order("name");

  const { data: mems } = await supabase
    .from("org_memberships")
    .select("organization_id")
    .eq("status", "approved");
  const counts = new Map<string, number>();
  for (const m of mems ?? []) counts.set(m.organization_id as string, (counts.get(m.organization_id as string) ?? 0) + 1);

  // Where the signed-in person stands with each organisation, so the card can
  // show "member", "awaiting approval" or an invitation to ask.
  const user = await getCurrentUser();
  const myState = new Map<string, "pending" | "approved" | "rejected">();
  if (user) {
    const { data: mine } = await supabase
      .from("org_memberships")
      .select("organization_id, status")
      .eq("user_id", user.id);
    for (const m of mine ?? []) {
      myState.set(m.organization_id as string, m.status as "pending" | "approved" | "rejected");
    }
  }

  const county = (v: unknown) =>
    Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name;

  const list = orgs ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center gap-1.5">
            <Building2 className="w-4 h-4" /> Networks
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink">Organisations across the movement</h1>
          <p className="mt-2 text-muted max-w-2xl">
            Community based organisations that make up the county networks. Each one is verified by the
            Hub before it appears here.
          </p>
        </header>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
            No organisations have been verified yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((o) => (
              <div key={o.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-050 text-purple flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" aria-label="Verified" />
                </div>
                <h2 className="mt-3 font-bold text-ink">{o.name}</h2>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {county(o.county_networks) ?? "Kenya"} · {counts.get(o.id) ?? 0} member(s)
                </p>
                {o.description && <p className="mt-2 text-sm text-muted line-clamp-3">{o.description}</p>}
                <div className="mt-4 flex items-center">
                  <JoinButton
                    organizationId={o.id as string}
                    organizationName={o.name as string}
                    state={myState.get(o.id as string) ?? "none"}
                    signedIn={!!user}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
