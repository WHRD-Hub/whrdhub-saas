import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCog, Building2, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ClaimAccount } from "@/components/account/claim-account";
import { DeleteAccount } from "@/components/account/delete-account";
import { Pill } from "@/components/ui/pill";

export const metadata = { title: "Account — WHRD Hub" };

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" } as const;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/account");

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("id, status, role, decision_notes, organizations(name)")
    .eq("user_id", user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <UserCog className="h-6 w-6 text-purple" /> Account
        </h1>
        <p className="mt-1 text-sm text-muted">
          How you sign in, which networks you belong to, and how to leave.
        </p>
      </div>

      {user.needsClaiming && <ClaimAccount username={user.profile?.username} />}

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black text-ink">
          <Building2 className="h-5 w-5 text-purple" /> Your networks
        </h2>
        {(memberships ?? []).length === 0 ? (
          <>
            <p className="mt-1 text-sm text-muted">
              You are not part of a county network yet. Joining one lets you post to the
              feed and publish stories.
            </p>
            <Link
              href="/organizations"
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600"
            >
              Find a network <ArrowUpRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {(memberships ?? []).map((m) => {
              const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
              const status = (m.status as keyof typeof STATUS_TONE) ?? "approved";
              return (
                <li key={m.id as string} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {(org as { name?: string } | null)?.name ?? "Organisation"}
                    </p>
                    {m.decision_notes ? (
                      <p className="mt-0.5 text-xs text-muted">{m.decision_notes as string}</p>
                    ) : null}
                  </div>
                  {m.role === "org_admin" && <Pill tone="purple">Network admin</Pill>}
                  <Pill tone={STATUS_TONE[status] ?? "slate"}>
                    {status === "pending" ? "Awaiting approval" : status}
                  </Pill>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DeleteAccount email={user.email} />
    </div>
  );
}
