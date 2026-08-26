import { createAdminClient } from "@/lib/supabase/admin";
import { LinkageGraph, type County, type Service, type Edge } from "@/components/reporting/linkages/linkage-graph";

export const metadata = { title: "Referral Linkages - WHRD Hub" };

interface Row {
  report_id: string;
  reports: { county: string | null; status: string | null } | { county: string | null; status: string | null }[] | null;
  services: { id: string; name: string; organization: string | null; category: string } | { id: string; name: string; organization: string | null; category: string }[] | null;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function LinkagesPage() {
  // Access is enforced by app/hub/reporting/layout.tsx.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const [{ data: links }, { data: services }] = await Promise.all([
    db.from("report_services").select("report_id, reports(county, status), services(id, name, organization, category)"),
    db.from("services").select("id, category, county, is_active"),
  ]);

  const rows = (links ?? []) as Row[];

  // Aggregate county -> service referral counts.
  const countyCount = new Map<string, number>();
  const svcMap = new Map<string, Service>();
  const edgeMap = new Map<string, Edge>();

  for (const r of rows) {
    const rep = one(r.reports);
    const svc = one(r.services);
    if (!svc) continue;
    const county = (rep?.county || "Unknown").trim() || "Unknown";
    countyCount.set(county, (countyCount.get(county) ?? 0) + 1);

    const s = svcMap.get(svc.id) ?? { id: svc.id, name: svc.name, org: svc.organization ?? null, category: svc.category, count: 0 };
    s.count += 1;
    svcMap.set(svc.id, s);

    const key = `${county}__${svc.id}`;
    const e = edgeMap.get(key) ?? { county, serviceId: svc.id, count: 0, category: svc.category };
    e.count += 1;
    edgeMap.set(key, e);
  }

  const counties: County[] = [...countyCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const servicesAgg: Service[] = [...svcMap.values()].sort((a, b) => b.count - a.count);
  const edges: Edge[] = [...edgeMap.values()];

  // Coverage gap: active service categories that have never received a referral.
  const linkedCategories = new Set(servicesAgg.map((s) => s.category));
  const activeCategories = new Set<string>();
  for (const s of (services ?? []) as { category: string; is_active: boolean }[]) {
    if (s.is_active) activeCategories.add(s.category);
  }
  const unusedCategories = [...activeCategories].filter((c) => !linkedCategories.has(c));

  const totalReferrals = rows.length;
  const categories = [...new Set(servicesAgg.map((s) => s.category))].sort();

  return (
    <LinkageGraph
      counties={counties}
      services={servicesAgg}
      edges={edges}
      categories={categories}
      totalReferrals={totalReferrals}
      unusedCategories={unusedCategories}
    />
  );
}
