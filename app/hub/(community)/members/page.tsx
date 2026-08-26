import Link from "next/link";
import { Mail, Users, Shield, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { DataTable, type Column } from "@/components/hub/data-table";

export const metadata = { title: "Members — WHRD Hub" };

interface Row {
  id: string; name: string; title: string | null; email: string; avatar: string | null;
  org: string; county: string; isOrgAdmin: boolean;
}

export default async function HubMembers() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: counties }, { data: mems }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, username, title, email, avatar_url, county_network_id, hub_onboarded")
      .eq("hub_onboarded", true)
      .is("account_deleted_at", null)
      .order("full_name"),
    supabase.from("county_networks").select("id, name").order("name"),
    supabase
      .from("org_memberships")
      .select("user_id, role, status, organizations(name)")
      .eq("status", "approved"),
  ]);

  const countyName = new Map((counties ?? []).map((c) => [c.id as string, c.name as string]));
  const orgByUser = new Map<string, string>();
  const adminUsers = new Set<string>();
  for (const m of mems ?? []) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    if (org) orgByUser.set(m.user_id as string, (org as { name: string }).name);
    if (m.role === "org_admin") adminUsers.add(m.user_id as string);
  }

  const rows: Row[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) || (p.username as string) || "WHRD member",
    title: (p.title as string) ?? null,
    email: (p.email as string) ?? "",
    avatar: (p.avatar_url as string) ?? null,
    org: orgByUser.get(p.id as string) ?? "—",
    county: countyName.get(p.county_network_id as string) ?? "No county",
    isOrgAdmin: adminUsers.has(p.id as string),
  }));

  const columns: Column<Row>[] = [
    {
      key: "member", header: "Member", width: "1.5fr",
      cell: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={r.name} src={r.avatar} size={34} />
          <div className="min-w-0"><p className="text-sm font-bold text-ink truncate">{r.name}</p>{r.title && <p className="text-xs text-muted truncate">{r.title}</p>}</div>
        </div>
      ),
    },
    { key: "contact", header: "Contact", width: "1.4fr", cell: (r) => <span className="text-xs text-muted truncate flex items-center gap-1.5">{r.email && <><Mail className="w-3 h-3 shrink-0" /> {r.email}</>}</span> },
    {
      key: "org", header: "CBO", width: "1fr",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs text-muted">{r.org}</span>
          {r.isOrgAdmin && (
            <Pill tone="purple" className="shrink-0">
              <Shield className="h-3 w-3" /> Admin
            </Pill>
          )}
        </span>
      ),
    },
    { key: "county", header: "County", width: "140px", cell: (r) => <span className="text-xs text-muted truncate">{r.county}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Members</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Every defender onboarded to the Hub, {rows.length} in total. Open a member to
            see everything they have posted.
          </p>
        </div>
        <Link
          href="/dashboard/network"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-purple-050"
        >
          Requests &amp; network admins <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/hub/members/${r.id}`}
        emptyIcon={Users}
        emptyTitle="No members yet"
        emptySubtitle="Defenders appear here once they complete Hub onboarding."
      />
    </div>
  );
}
