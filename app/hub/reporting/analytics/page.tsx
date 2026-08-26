import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReportsCharts } from "@/components/reporting/admin/reports-charts";
import { BarChart2 } from "lucide-react";

async function AnalyticsContent() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, incident_types, status, urgency, verification_status, reporter_type, county, attack_nature, derogatory_words, created_at");

  const total = reports?.length ?? 0;

  const incidentCounts: Record<string, number> = {};
  reports?.forEach(r => {
    (r.incident_types as string[]).forEach(t => {
      incidentCounts[t] = (incidentCounts[t] || 0) + 1;
    });
  });
  const incidentBreakdown = Object.entries(incidentCounts)
    .map(([k, v]) => ({ name: k.replace(/_/g, " "), count: v }))
    .sort((a, b) => b.count - a.count);

  const countyCounts: Record<string, number> = {};
  reports?.forEach(r => { if (r.county) countyCounts[r.county] = (countyCounts[r.county] || 0) + 1; });
  const countyBreakdown = Object.entries(countyCounts)
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count);

  const urgencyBreakdown = [
    { name: "Immediate",    count: reports?.filter(r => r.urgency === "immediate").length    ?? 0 },
    { name: "Within Week",  count: reports?.filter(r => r.urgency === "within_week").length  ?? 0 },
    { name: "No Rush",      count: reports?.filter(r => r.urgency === "no_rush").length      ?? 0 },
  ];

  const verificationBreakdown = [
    { name: "Pending",      count: reports?.filter(r => r.verification_status === "pending").length        ?? 0 },
    { name: "Verified",     count: reports?.filter(r => r.verification_status === "verified").length       ?? 0 },
    { name: "Unverified",   count: reports?.filter(r => r.verification_status === "unverified").length     ?? 0 },
    { name: "Needs Info",   count: reports?.filter(r => r.verification_status === "needs_more_info").length ?? 0 },
  ];

  const anonymous = reports?.filter(r => r.reporter_type === "anonymous").length ?? 0;
  const reporterTypeBreakdown = [
    { name: "Anonymous",    value: anonymous },
    { name: "Authenticated",value: total - anonymous },
  ];

  const attackNatureCounts: Record<string, number> = {};
  reports?.forEach(r => {
    if (r.attack_nature) attackNatureCounts[r.attack_nature] = (attackNatureCounts[r.attack_nature] || 0) + 1;
  });
  const attackNatureBreakdown = Object.entries(attackNatureCounts)
    .map(([k, v]) => ({ name: k.replace(/_/g, " "), count: v }))
    .sort((a, b) => b.count - a.count);

  // Derogatory words frequency
  const wordCounts: Record<string, number> = {};
  reports?.forEach(r => {
    ((r.derogatory_words ?? []) as string[]).forEach(w => {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  const derogatoryWordBreakdown = Object.entries(wordCounts)
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Monthly trend (last 6 months)
  const months: Record<string, { anonymous: number; authenticated: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
    months[key] = { anonymous: 0, authenticated: 0 };
  }
  reports?.forEach(r => {
    const key = new Date(r.created_at!).toLocaleString("en", { month: "short", year: "2-digit" });
    if (months[key]) months[key][r.reporter_type === "anonymous" ? "anonymous" : "authenticated"]++;
  });
  const monthlyTrend = Object.entries(months).map(([month, v]) => ({ month, ...v }));

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-ink mb-1 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-purple" />
          Analytics
        </h1>
        <p className="text-muted text-sm">
          Platform-wide report trends, TFGBV classification breakdown, and attack pattern analysis.
        </p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total reports",      value: total },
          { label: "Verified",           value: verificationBreakdown[1].count },
          { label: "Immediate urgency",  value: urgencyBreakdown[0].count },
          { label: "Incident types",     value: incidentBreakdown.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-line p-4">
            <p className="text-2xl font-black">{value}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <ReportsCharts
        data={{
          incidentBreakdown,
          countyBreakdown,
          urgencyBreakdown,
          verificationBreakdown,
          reporterTypeBreakdown,
          monthlyTrend,
          attackNatureBreakdown,
          derogatoryWordBreakdown,
        }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border h-32 animate-pulse" />
        ))}
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
