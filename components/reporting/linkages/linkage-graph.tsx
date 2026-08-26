"use client";

import { useMemo, useState } from "react";
import { Share2, MapPin, Building2, GitBranch, AlertTriangle } from "lucide-react";

export interface County { name: string; count: number }
export interface Service { id: string; name: string; org: string | null; category: string; count: number }
export interface Edge { county: string; serviceId: string; count: number; category: string }

const CAT_COLOR: Record<string, string> = {
  legal: "#2563eb", medical: "#dc2626", psychosocial: "#7c3aed", shelter: "#ea580c",
  digital_security: "#0891b2", financial: "#16a34a", referral: "#64748b", other: "#9333ea",
};
const catColor = (c: string) => CAT_COLOR[c] ?? "#64748b";
const catLabel = (c: string) => c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const trunc = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const W = 1000, NODE_W = 288, LEFT_X = 8, RIGHT_X = W - NODE_W - 8;
const ROW = 50, BOX_H = 40, PAD = 12;
const cx1 = LEFT_X + NODE_W, cx2 = RIGHT_X;

export function LinkageGraph({
  counties, services, edges, categories, totalReferrals, unusedCategories,
}: {
  counties: County[]; services: Service[]; edges: Edge[]; categories: string[];
  totalReferrals: number; unusedCategories: string[];
}) {
  const [cat, setCat] = useState<string>("all");
  const [hover, setHover] = useState<string | null>(null); // "c:<county>" | "s:<id>"

  const view = useMemo(() => {
    const svc = (cat === "all" ? services : services.filter((s) => s.category === cat)).slice(0, 14);
    const svcIds = new Set(svc.map((s) => s.id));
    let e = edges.filter((x) => svcIds.has(x.serviceId) && (cat === "all" || x.category === cat));
    const countyNames = new Set(e.map((x) => x.county));
    const cty = counties.filter((c) => countyNames.has(c.name)).slice(0, 14);
    const ctySet = new Set(cty.map((c) => c.name));
    e = e.filter((x) => ctySet.has(x.county));
    return { svc, cty, e };
  }, [cat, services, counties, edges]);

  const { svc, cty, e } = view;
  const ctyY = new Map(cty.map((c, i) => [c.name, PAD + i * ROW]));
  const svcY = new Map(svc.map((s, i) => [s.id, PAD + i * ROW]));
  const H = Math.max(cty.length, svc.length, 1) * ROW + PAD;
  const maxEdge = Math.max(1, ...e.map((x) => x.count));

  // connectivity for hover highlight
  const relCounties = new Set<string>(), relServices = new Set<string>();
  if (hover) {
    for (const x of e) {
      if (hover === `c:${x.county}` || hover === `s:${x.serviceId}`) { relCounties.add(x.county); relServices.add(x.serviceId); }
    }
  }
  const edgeActive = (x: Edge) => !hover || hover === `c:${x.county}` || hover === `s:${x.serviceId}`;
  const nodeActive = (id: string) => !hover || hover === id || (id.startsWith("c:") ? relCounties.has(id.slice(2)) : relServices.has(id.slice(2)));

  const kpis = [
    { icon: Share2, label: "Total referrals", value: totalReferrals, tint: "bg-purple/10 text-purple" },
    { icon: Building2, label: "Services engaged", value: services.length, tint: "bg-emerald-100 text-emerald-700" },
    { icon: MapPin, label: "Counties linked", value: counties.length, tint: "bg-cyan-100 text-cyan-700" },
    { icon: GitBranch, label: "Top service", value: services[0]?.name ? trunc(services[0].name, 16) : "—", tint: "bg-purple-100 text-purple-700" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink flex items-center gap-2"><GitBranch className="w-6 h-6 text-purple" /> Referral Linkages</h1>
        <p className="text-sm text-muted mt-1">How reports connect to the service providers they are referred to, by county and support type.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-surface p-4">
            <span className={`w-9 h-9 rounded-lg grid place-items-center ${k.tint}`}><k.icon className="w-4 h-4" /></span>
            <p className="mt-2 text-xl font-black text-ink truncate">{k.value}</p>
            <p className="text-xs text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      {totalReferrals === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-12 text-center">
          <GitBranch className="w-8 h-8 mx-auto text-purple/60" />
          <p className="mt-3 font-semibold text-ink">No referrals to visualise yet</p>
          <p className="text-sm text-muted mt-1">Once reports are matched to services, the linkages between counties and providers will appear here.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCat("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${cat === "all" ? "bg-purple text-white border-purple" : "border-line text-muted hover:bg-paper"}`}>
              All support types
            </button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${cat === c ? "text-white border-transparent" : "border-line text-muted hover:bg-paper"}`}
                style={cat === c ? { backgroundColor: catColor(c) } : undefined}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor(c) }} /> {catLabel(c)}
              </button>
            ))}
          </div>

          {/* Graph */}
          <div className="rounded-xl border border-line bg-surface p-3 sm:p-5 overflow-x-auto">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-muted px-1 mb-2" style={{ minWidth: 560 }}>
              <span>County</span><span>Service provider</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, height: "auto" }} role="img" aria-label="Referral linkage graph">
              {/* edges */}
              {e.map((x) => {
                const y1 = (ctyY.get(x.county) ?? 0) + BOX_H / 2;
                const y2 = (svcY.get(x.serviceId) ?? 0) + BOX_H / 2;
                const active = edgeActive(x);
                return (
                  <path key={`${x.county}-${x.serviceId}`}
                    d={`M ${cx1} ${y1} C ${W / 2} ${y1}, ${W / 2} ${y2}, ${cx2} ${y2}`}
                    fill="none" stroke={catColor(x.category)}
                    strokeWidth={1.5 + (x.count / maxEdge) * 7}
                    strokeOpacity={active ? 0.55 : 0.07}
                    strokeLinecap="round" />
                );
              })}

              {/* county nodes */}
              {cty.map((c) => {
                const y = ctyY.get(c.name) ?? 0; const id = `c:${c.name}`;
                return (
                  <g key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", opacity: nodeActive(id) ? 1 : 0.3 }}>
                    <rect x={LEFT_X} y={y} width={NODE_W} height={BOX_H} rx={9} fill="#ffffff" stroke={hover === id ? "#1f2937" : "#e5e7eb"} strokeWidth={hover === id ? 2 : 1} />
                    <text x={LEFT_X + 12} y={y + BOX_H / 2 + 4} fontSize={13} fontWeight={700} fill="#1f2937">{trunc(c.name, 24)}</text>
                    <text x={LEFT_X + NODE_W - 12} y={y + BOX_H / 2 + 4} fontSize={12} fontWeight={700} fill="#6b7280" textAnchor="end">{c.count}</text>
                  </g>
                );
              })}

              {/* service nodes */}
              {svc.map((s) => {
                const y = svcY.get(s.id) ?? 0; const id = `s:${s.id}`; const col = catColor(s.category);
                return (
                  <g key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", opacity: nodeActive(id) ? 1 : 0.3 }}>
                    <rect x={RIGHT_X} y={y} width={NODE_W} height={BOX_H} rx={9} fill="#ffffff" stroke={hover === id ? "#1f2937" : "#e5e7eb"} strokeWidth={hover === id ? 2 : 1} />
                    <rect x={RIGHT_X} y={y} width={4} height={BOX_H} rx={2} fill={col} />
                    <text x={RIGHT_X + 14} y={y + BOX_H / 2 + 4} fontSize={13} fontWeight={700} fill="#1f2937">{trunc(s.name, 24)}</text>
                    <text x={RIGHT_X + NODE_W - 12} y={y + BOX_H / 2 + 4} fontSize={12} fontWeight={700} fill="#6b7280" textAnchor="end">{s.count}</text>
                  </g>
                );
              })}
            </svg>
            <p className="text-[11px] text-muted mt-2 px-1">Line thickness shows how many reports flow along each link. Hover a node to isolate its connections.{(counties.length > 14 || services.length > 14) ? " Showing the top 14 on each side." : ""}</p>
          </div>

          {/* Coverage gap */}
          {unusedCategories.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-bold">Idle service types:</span> {unusedCategories.map(catLabel).join(", ")} {unusedCategories.length === 1 ? "has" : "have"} active providers but no referrals yet. Worth checking whether reports needing this support are being linked.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
