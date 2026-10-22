import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { MapView, type MapReport } from "@/components/reporting/map-view";
import { generaliseArea } from "@/lib/geo-privacy";

export const metadata = { title: "Incident map — WHRD Hub" };

async function MapData() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select(
      "id, latitude, longitude, incident_types, county, urgency, reporter_type, verification_status, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  // The exact point stays in the database. Only a wide area leaves the server,
  // so no coordinates ever reach the browser.
  const safe: MapReport[] = (reports ?? []).map((r) => ({
    id: r.id as string,
    area: generaliseArea(r.latitude as number | null, r.longitude as number | null),
    incident_types: r.incident_types as string[] | null,
    county: r.county as string | null,
    urgency: r.urgency as string | null,
    reporter_type: r.reporter_type as string | null,
    verification_status: r.verification_status as string | null,
    created_at: r.created_at as string | null,
  }));

  return <MapView reports={safe} />;
}

export default function MapPage() {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Incident map</h1>
        <p className="text-sm text-muted">Where cases are concentrated, by county and approximate area.</p>
      </header>

      {/* The map is the page: it takes the rest of the screen, and its controls float on top of it. */}
      <div className="card-premium relative h-[calc(100dvh-11rem)] min-h-[34rem] overflow-hidden !rounded-3xl">
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading map data…</div>}>
          <MapData />
        </Suspense>
      </div>
    </div>
  );
}
