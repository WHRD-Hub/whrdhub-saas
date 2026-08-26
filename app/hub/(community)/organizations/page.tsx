import { Building2, ShieldCheck, Clock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Pill } from "@/components/ui/pill";
import { StatBar, type StatItem } from "@/components/hub/stat-bar";
import { DataTable, type Column } from "@/components/hub/data-table";
import { VERIF_STATUS_META } from "@/lib/data";

export const metadata = { title: "CBOs — WHRD Hub" };

interface Org {
  id: string; name: string; verification_status: string; members: number; county: string;
}

export default async function HubOrganizations() {
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, verification_status, created_at, county_networks(name)")
    .order("verification_status")
    .order("created_at", { ascending: false });

  const { data: mems } = await supabase.from("org_memberships").select("organization_id");
  const counts = new Map<string, number>();
  for (const m of mems ?? []) counts.set(m.organization_id as string, (counts.get(m.organization_id as string) ?? 0) + 1);

  const countyName = (v: unknown) =>
    Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name;

  const rows: Org[] = (orgs ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    verification_status: o.verification_status as string,
    members: counts.get(o.id as string) ?? 0,
    county: countyName(o.county_networks) ?? "No county",
  }));

  const verified = rows.filter((o) => o.verification_status === "verified").length;
  const pending = rows.filter((o) => o.verification_status === "pending").length;
  const totalMembers = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  const stats: StatItem[] = [
    { label: "Total CBOs", value: rows.length, icon: Building2, caption: "in the network", tint: "bg-purple-050 text-purple" },
    { label: "Verified", value: verified, icon: ShieldCheck, caption: "publishing content", captionTone: "up", tint: "bg-emerald-50 text-emerald-700" },
    { label: "Awaiting", value: pending, icon: Clock, caption: pending > 0 ? "to verify" : "all clear", captionTone: pending > 0 ? "down" : "up", tint: "bg-amber-50 text-amber-700" },
    { label: "Members", value: totalMembers, icon: Users, caption: "across all CBOs", tint: "bg-cyan-050 text-cyan-700" },
  ];

  const columns: Column<Org>[] = [
    {
      key: "name", header: "Organisation", width: "1.6fr",
      cell: (o) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-purple-050 text-purple grid place-items-center shrink-0"><Building2 className="w-4 h-4" /></span>
          <span className="text-sm font-bold text-ink truncate">{o.name}</span>
        </div>
      ),
    },
    { key: "county", header: "County", width: "140px", cell: (o) => <span className="text-xs text-muted truncate">{o.county}</span> },
    { key: "members", header: "Members", width: "110px", cell: (o) => <span className="text-xs text-muted">{o.members} member(s)</span> },
    { key: "status", header: "Status", width: "160px", cell: (o) => <Pill tone={VERIF_STATUS_META[o.verification_status]?.tone ?? "slate"}>{VERIF_STATUS_META[o.verification_status]?.label ?? o.verification_status}</Pill> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink">CBOs</h1>
        <p className="text-sm text-muted mt-1">Every community-based organisation across the network. Open one to see its members or verify it.</p>
      </div>

      <StatBar items={stats} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        rowHref={(o) => `/hub/organizations/${o.id}`}
        emptyIcon={Building2}
        emptyTitle="No CBOs yet"
        emptySubtitle="Community-based organisations appear here as they register."
      />
    </div>
  );
}
