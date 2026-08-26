import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboardClient, type Report } from "@/components/reporting/admin/dashboard-client";

async function AdminDashboardData() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, incident_types, status, urgency, verification_status, reporter_type, county, created_at, latitude, longitude, description, perpetrator_type, channel");

  return <AdminDashboardClient reports={(reports ?? []) as Report[]} />;
}

export const metadata = { title: "Reporting dashboard — WHRD Hub" };

export default function ReportingOverviewPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-8 w-48 bg-paper rounded animate-pulse" />
        <div className="h-24 grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-paper rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-paper rounded-xl animate-pulse" />
      </div>
    }>
      <AdminDashboardData />
    </Suspense>
  );
}
