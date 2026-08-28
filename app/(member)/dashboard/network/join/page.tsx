import { Suspense } from "react";
import Link from "next/link";
import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { RowsSkeleton } from "@/components/ui/skeleton";
import { JoinButton } from "@/components/network/join-button";
import { VERIF_STATUS_META } from "@/lib/data";

export const metadata = { title: "Join an organisation — WHRD Hub" };

/**
 * Find a chapter to join, by county.
 *
 * Membership is what turns an account into a participant: writing to the feed
 * and publishing a story both require belonging somewhere, because the Hub
 * attributes content to a network rather than to a lone individual. Somebody
 * who arrived by filing a report has an account and nothing else, so this is
 * the page that lets her become part of a chapter if she wants to — and it is
 * only ever an offer. Reporting never required membership and still does not.
 */
export default async function JoinOrganisationPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ink">Join an organisation</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          WHRD Hub is a network of county chapters. Joining one lets you post to the community
          feed and publish stories under your chapter&apos;s name. Your reports stay private
          either way — this changes nothing about them.
        </p>
      </div>
      <Suspense fallback={<RowsSkeleton rows={5} />}>
        <Organisations />
      </Suspense>
    </>
  );
}

async function Organisations() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: counties }, { data: orgs }, { data: mine }] = await Promise.all([
    supabase.from("county_networks").select("id, name, slug").eq("is_active", true).order("name"),
    supabase
      .from("organizations")
      .select("id, name, slug, description, county_network_id, verification_status, logo_url")
      .order("name"),
    supabase
      .from("org_memberships")
      .select("organization_id, status")
      .eq("user_id", user!.id),
  ]);

  const stateOf = new Map(
    (mine ?? []).map((m) => [m.organization_id as string, m.status as string]),
  );
  const alreadyIn = (mine ?? []).some((m) => m.status === "approved");

  const byCounty = new Map<string, typeof orgs>();
  for (const o of orgs ?? []) {
    const key = (o.county_network_id as string) ?? "none";
    byCounty.set(key, [...(byCounty.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-6">
      {alreadyIn && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-900">
            You are already a member of a chapter. You can ask to join another, but most
            people belong to one.
          </p>
        </div>
      )}

      {(counties ?? []).map((county) => {
        const list = byCounty.get(county.id as string) ?? [];
        if (!list.length) return null;
        return (
          <section key={county.id as string}>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-black text-ink">
              <MapPin className="h-4 w-4 text-purple" />
              {county.name as string}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((o) => {
                const state = (stateOf.get(o.id as string) ?? "none") as
                  | "none" | "pending" | "approved" | "rejected";
                return (
                  <li
                    key={o.id as string}
                    className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,21,34,0.04)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-050 text-purple">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{o.name as string}</p>
                        <div className="mt-1">
                          <Pill tone={VERIF_STATUS_META[o.verification_status as string]?.tone ?? "slate"}>
                            {VERIF_STATUS_META[o.verification_status as string]?.label ??
                              (o.verification_status as string)}
                          </Pill>
                        </div>
                      </div>
                    </div>
                    {o.description ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                        {o.description as string}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <JoinButton
                        organizationId={o.id as string}
                        organizationName={o.name as string}
                        state={state}
                        signedIn
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-sm text-muted">
        Cannot find your chapter?{" "}
        <Link href="/contact" className="font-semibold text-purple hover:underline">
          Tell us about it
        </Link>{" "}
        and the Hub can add it.
      </p>
    </div>
  );
}
