import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MapView } from "@/components/reporting/map-view";

export const metadata = { title: "Incident map — WHRD Hub" };

async function MapData() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select(
      "id, latitude, longitude, incident_types, county, urgency, reporter_type, verification_status, created_at",
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  return <MapView reports={reports ?? []} />;
}

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/hub/reporting/reports"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-purple"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <MapPin className="h-6 w-6 text-purple" /> Incident map
        </h1>
        <p className="mt-1 text-sm text-muted">
          Reports carrying GPS coordinates. Locations are shown without reporter identity.
        </p>
      </div>

      {/* The map needs a fixed height inside the dashboard shell's flow. */}
      <div className="h-[70vh] min-h-[28rem] overflow-hidden rounded-2xl border border-line bg-surface">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-sm text-muted">
              Loading map data…
            </div>
          }
        >
          <MapData />
        </Suspense>
      </div>
    </div>
  );
}
