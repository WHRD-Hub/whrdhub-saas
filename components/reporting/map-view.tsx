"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen, ShieldCheck, X } from "lucide-react";
import { loadLeaflet } from "@/lib/leaflet";
import { INCIDENT_TYPES, OTHER_COUNTRIES, incidentLabel } from "@/lib/reporting-options";
import { URGENCY_META, urgencyMeta } from "@/lib/urgency";
import { cn, timeAgo } from "@/lib/utils";

/** A report as the map sees it: a general area, never the exact point. */
export interface MapReport {
  id: string;
  area: { lat: number; lng: number; radiusM: number } | null;
  incident_types: string[] | null;
  county: string | null;
  urgency: string | null;
  reporter_type: string | null;
  verification_status: string | null;
  created_at: string | null;
}

/** Light to deep violet: the more cases in a county, the darker it is. */
const SCALE = ["#f1ecf8", "#dccdf1", "#bf9fe3", "#9a6bcb", "#6f43a3", "#4d2f73"];
const colourFor = (count: number, max: number) => {
  if (count <= 0) return "#f7f5fa";
  const step = Math.min(SCALE.length - 1, Math.max(1, Math.ceil((count / Math.max(max, 1)) * (SCALE.length - 1))));
  return SCALE[step];
};

const RANGES = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
] as const;

// CARTO Voyager with the project's key; without a key, fall back to the keyless light style.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;
const TILE_URL = CARTO_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The incident map. The map is the page: filters float over its top edge and an
 * insights panel sits on the right (a sheet on a phone). Counties are shaded by
 * how many cases they hold, circles mark approximate areas, and every control
 * recalculates the shading, the ranking and the list together.
 */
export function MapView({ reports }: { reports: MapReport[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("all");
  const [urgency, setUrgency] = useState("");
  const [type, setType] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [tab, setTab] = useState<"counties" | "cases">("counties");
  const [panel, setPanel] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const circlesRef = useRef<Map<string, any>>(new Map());
  const LRef = useRef<any>(null);
  const restyleRef = useRef<(l: any) => void>(() => {});

  // Fixed when the page opens, so "last 7 days" means the same thing for the whole visit.
  const [openedAt] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null;
    const since = days ? openedAt - days * 86_400_000 : 0;
    return reports.filter(
      (r) =>
        (!urgency || r.urgency === urgency) &&
        (!type || (r.incident_types ?? []).includes(type)) &&
        (!days || (r.created_at ? new Date(r.created_at).getTime() >= since : false)),
    );
  }, [reports, range, urgency, type, openedAt]);

  // Cases per county (Kenya) and per other country, from the filtered set.
  const { counts, names, outside, max, ranking } = useMemo(() => {
    const c = new Map<string, number>();
    const n = new Map<string, string>();
    const out: Record<string, number> = {};
    for (const r of filtered) {
      if (!r.county) continue;
      if ((OTHER_COUNTRIES as readonly string[]).includes(r.county)) { out[r.county] = (out[r.county] ?? 0) + 1; continue; }
      const k = norm(r.county);
      c.set(k, (c.get(k) ?? 0) + 1);
      if (!n.has(k)) n.set(k, r.county);
    }
    const rank = [...c.entries()].map(([k, v]) => ({ key: k, name: n.get(k) ?? k, count: v })).sort((a, b) => b.count - a.count);
    return { counts: c, names: n, outside: out, max: Math.max(0, ...c.values()), ranking: rank };
  }, [filtered]);

  const urgent = filtered.filter((r) => r.urgency === "immediate").length;
  const cases = useMemo(
    () => (county ? filtered.filter((r) => r.county && norm(r.county) === county) : filtered)
      .slice()
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [filtered, county],
  );
  const typesPresent = INCIDENT_TYPES.filter((t) => reports.some((r) => (r.incident_types ?? []).includes(t.value)));

  // ── Build the map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;

    loadLeaflet()
      .then(async (L) => {
        if (cancelled || !mapEl.current) return;
        LRef.current = L;
        const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 12 }).setView([0.2, 37.9], 6);
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        mapRef.current = map;
        L.tileLayer(TILE_URL, {
          attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · boundaries: geoBoundaries',
          maxZoom: 12,
        }).addTo(map);
        groupRef.current = L.layerGroup().addTo(map);

        try {
          const geo = await (await fetch("/geo/kenya-counties.json")).json();
          if (cancelled) return;
          const layer = L.geoJSON(geo, {
            style: () => ({ fillColor: "#f7f5fa", fillOpacity: 0.72, color: "#ffffff", weight: 1 }),
            onEachFeature: (f: any, l: any) => {
              l.on({
                mouseover: () => { if (!l._selected) l.setStyle({ weight: 2, color: "#734e9e" }); l.bringToFront(); },
                mouseout: () => restyleRef.current(l),
                click: () => setCounty((cur) => (cur === norm(f.properties.name) ? null : norm(f.properties.name))),
              });
            },
          }).addTo(map);
          layerRef.current = layer;
          map.fitBounds(layer.getBounds(), { padding: [12, 12] });
        } catch {
          setMapError("The county boundaries could not be loaded.");
        }
        setReady(true);
      })
      .catch(() => setMapError("The map could not be loaded."));

    const circles = circlesRef.current;
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      groupRef.current = null;
      circles.clear();
    };
  }, []);

  // ── Shading, tooltips and the selected county follow the data ────────────
  useEffect(() => {
    const layer = layerRef.current;
    if (!ready || !layer) return;
    const style = (l: any) => {
      const key = norm(l.feature.properties.name);
      const on = county === key;
      l._selected = on;
      l.setStyle({ fillColor: colourFor(counts.get(key) ?? 0, max), fillOpacity: 0.72, color: on ? "#ce2087" : "#ffffff", weight: on ? 3 : 1 });
      if (on) l.bringToFront();
    };
    restyleRef.current = style;
    layer.eachLayer((l: any) => {
      style(l);
      const n = counts.get(norm(l.feature.properties.name)) ?? 0;
      l.unbindTooltip();
      l.bindTooltip(`<strong>${l.feature.properties.name}</strong><br/>${n} case${n === 1 ? "" : "s"}`, { sticky: true, direction: "top" });
    });
  }, [ready, counts, max, county]);

  // ── Approximate areas ────────────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current;
    const group = groupRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    circlesRef.current.clear();
    if (!showAreas) return;
    for (const r of filtered) {
      if (!r.area) continue;
      const colour = urgencyMeta(r.urgency).hex;
      const circle = L.circle([r.area.lat, r.area.lng], { radius: r.area.radiusM, color: colour, weight: 1.5, fillColor: colour, fillOpacity: 0.3 });
      circle.bindPopup(`
        <div style="font-family:system-ui,sans-serif;font-size:12px;min-width:190px">
          <p style="font-weight:700;margin:0 0 4px;font-size:13px">${(r.incident_types || []).map(incidentLabel).join(", ") || "Incident"}</p>
          <p style="color:#666;margin:0 0 2px"><strong>${r.county || "County not given"}</strong> · approximate area</p>
          <p style="margin:0 0 2px">Urgency: <span style="color:${colour};font-weight:600">${urgencyMeta(r.urgency).label}</span></p>
          <p style="margin:4px 0 0"><a href="/hub/reporting/reports/${r.id}" style="color:#734e9e;font-weight:600;text-decoration:underline">Open report →</a></p>
        </div>`);
      circle.on("click", () => { setTab("cases"); setPanel(true); });
      group.addLayer(circle);
      circlesRef.current.set(r.id, circle);
    }
  }, [ready, filtered, showAreas]);

  // ── Zoom to the chosen county, or back out to the whole country ─────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;
    if (!county) { map.flyToBounds(layer.getBounds(), { padding: [12, 12], duration: 0.6 }); return; }
    layer.eachLayer((l: any) => {
      if (norm(l.feature.properties.name) === county) map.flyToBounds(l.getBounds(), { padding: [60, 60], maxZoom: 9, duration: 0.6 });
    });
  }, [ready, county]);

  const focusCase = (r: MapReport) => {
    const map = mapRef.current;
    const circle = circlesRef.current.get(r.id);
    if (map && r.area) map.flyTo([r.area.lat, r.area.lng], 10, { duration: 0.7 });
    circle?.openPopup();
  };

  const countyLabel = county ? names.get(county) ?? ranking.find((x) => x.key === county)?.name ?? county : null;
  const filtersOn = !!(urgency || type || range !== "all");

  const pill = "h-8 appearance-none rounded-full border pl-3 pr-7 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple/30";

  return (
    <div className="relative h-full w-full">
      <div ref={mapEl} className="absolute inset-0" />

      {mapError && <p className="absolute left-4 top-16 z-[1000] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{mapError}</p>}

      {/* Filters, floating over the top edge */}
      <div className={cn("absolute left-3 top-3 z-[1000] flex flex-wrap items-center gap-2", panel ? "right-3 lg:right-[23.75rem]" : "right-14")}>
        <div role="tablist" aria-label="Time range" className="flex rounded-full border border-line bg-surface/95 p-0.5 shadow-sm backdrop-blur">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors", range === r.id ? "bg-purple text-white" : "text-muted hover:text-ink")}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)} aria-label="Urgency" className={cn(pill, urgency ? "border-purple/40 bg-purple-050 text-purple-700" : "border-line bg-surface/95 text-muted")}>
            <option value="">Any urgency</option>
            {Object.entries(URGENCY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
        <div className="relative">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Incident type" className={cn(pill, "max-w-[11rem]", type ? "border-purple/40 bg-purple-050 text-purple-700" : "border-line bg-surface/95 text-muted")}>
            <option value="">Any incident</option>
            {typesPresent.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
        <button onClick={() => setShowAreas((s) => !s)} aria-pressed={showAreas}
          className={cn("h-8 rounded-full border px-3 text-xs font-semibold shadow-sm backdrop-blur transition-colors", showAreas ? "border-purple/40 bg-purple-050 text-purple-700" : "border-line bg-surface/95 text-muted")}>
          Areas
        </button>
        {filtersOn && (
          <button onClick={() => { setRange("all"); setUrgency(""); setType(""); }} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface/95 px-3 text-xs font-semibold text-muted shadow-sm backdrop-blur hover:text-ink">
            <X className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Colour key */}
      <div className="absolute bottom-3 left-14 z-[1000] hidden items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] font-medium text-muted shadow-sm backdrop-blur sm:flex">
        Fewer
        <span className="flex overflow-hidden rounded-full">{SCALE.map((c) => <span key={c} className="h-2.5 w-5" style={{ background: c }} />)}</span>
        {max > 0 ? `${max} cases` : "More"}
      </div>

      {!panel && (
        <button onClick={() => setPanel(true)} aria-label="Show insights" className="absolute right-3 top-3 z-[1000] grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/95 text-ink shadow-sm backdrop-blur hover:bg-paper">
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      {/* Insights: a panel on large screens, a sheet on a phone */}
      {panel && (
        <aside className="absolute inset-x-3 bottom-3 z-[1000] flex max-h-[52%] flex-col overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-premium backdrop-blur lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[22.5rem]">
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
            <div className="min-w-0">
              <p className="eyebrow">{countyLabel ? "County" : "Kenya"}</p>
              <p className="truncate text-base font-bold tracking-tight text-ink">{countyLabel ?? "All counties"}</p>
            </div>
            <div className="flex items-center gap-1">
              {county && <button onClick={() => setCounty(null)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-purple hover:bg-purple-050">Show all</button>}
              <button onClick={() => setPanel(false)} aria-label="Hide insights" className="rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink"><PanelRightClose className="h-4 w-4" /></button>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 px-4 py-3">
            {[
              { k: "Cases", v: cases.length, hot: false },
              { k: "Counties", v: ranking.length, hot: false },
              { k: "Urgent", v: county ? cases.filter((r) => r.urgency === "immediate").length : urgent, hot: true },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-paper px-3 py-2">
                <dt className="eyebrow">{s.k}</dt>
                <dd className={cn("text-xl font-bold tracking-tight", s.hot && s.v > 0 ? "text-rose-600" : "text-ink")}>{s.v}</dd>
              </div>
            ))}
          </dl>

          <div role="tablist" aria-label="Insights" className="mx-4 flex gap-1 rounded-xl bg-paper p-1">
            {([["counties", "Counties"], ["cases", "Cases"]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors", tab === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
                {label}
              </button>
            ))}
          </div>

          <div className="feed-scroll mt-2 min-h-0 flex-1 overflow-y-auto pb-2">
            {tab === "counties" && (
              <ul className="px-2">
                {ranking.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">No cases match these filters.</li>}
                {ranking.map((r) => (
                  <li key={r.key}>
                    <button onClick={() => setCounty(county === r.key ? null : r.key)} className={cn("block w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-paper", county === r.key && "bg-purple-050")}>
                      <span className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-ink">{r.name}</span>
                        <span className="font-bold tabular-nums text-ink">{r.count}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper">
                        <span className="block h-full rounded-full bg-purple" style={{ width: `${Math.max(6, (r.count / Math.max(max, 1)) * 100)}%`, opacity: 0.35 + 0.65 * (r.count / Math.max(max, 1)) }} />
                      </span>
                    </button>
                  </li>
                ))}
                {Object.keys(outside).length > 0 && (
                  <li className="mt-1 border-t border-line px-2.5 py-2 text-xs text-muted">
                    Outside Kenya: {Object.entries(outside).map(([k, v]) => `${k} ${v}`).join(", ")}
                  </li>
                )}
              </ul>
            )}

            {tab === "cases" && (
              <ul className="divide-y divide-line px-2">
                {cases.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">No cases here.</li>}
                {cases.slice(0, 100).map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5 px-2.5 py-2.5">
                    <button onClick={() => focusCase(r)} disabled={!r.area} className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: urgencyMeta(r.urgency).hex }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">{(r.incident_types || []).map(incidentLabel).slice(0, 2).join(" · ") || "Incident"}</span>
                        <span className="block truncate text-xs text-muted">{[r.county, r.created_at ? timeAgo(r.created_at) : null, r.area ? null : "no map position"].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                    <Link href={`/hub/reporting/reports/${r.id}`} aria-label="Open report" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-paper hover:text-purple"><ChevronRight className="h-4 w-4" /></Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-1.5 border-t border-line px-4 py-2.5 text-[11px] leading-snug text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Circles are wide approximate areas, never exact locations, and carry no reporter identity.
          </p>
        </aside>
      )}
    </div>
  );
}
