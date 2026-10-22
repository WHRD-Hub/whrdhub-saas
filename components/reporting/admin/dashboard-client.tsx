"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle, AlertTriangle, Shield, Plus, Smartphone } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ReportRow } from "@/components/reporting/report-row";
import { incidentLabel } from "@/lib/reporting-options";
import { URGENCY_META, URGENCY_ORDER, urgencyHexByLabel, type Urgency } from "@/lib/urgency";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

export interface Report {
  id: string;
  incident_types: string[];
  status: string;
  urgency: string;
  verification_status: string;
  reporter_type: string;
  county?: string | null;
  created_at: string;
  description?: string | null;
  perpetrator_type?: string | null;
  channel?: string | null;
}

const PURPLE = "#734e9e";
const GOLD = "#ce2087";
const COLORS = [PURPLE, GOLD, "#10b981", "#3b82f6", "#f43f5e", "#8b5cf6", "#f97316", "#06b6d4"];


/**
 * The Hub's stat tile: a pastel surface with a white icon chip, matching the
 * management cards on the community overview so the two consoles read as one.
 */
function StatCard({
  label, value, icon: Icon, bg, ic,
}: {
  label: string; value: number; icon: React.ElementType; bg: string; ic: string;
}) {
  return (
    <div className={`rounded-2xl ${bg} p-5`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl bg-surface ${ic}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-3xl font-black leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-ink/55">{label}</p>
    </div>
  );
}


export function AdminDashboardClient({ reports }: { reports: Report[] }) {
  const [countyFilter, setCountyFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [verifFilter, setVerifFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "urgency">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let f = [...reports];
    if (countyFilter) f = f.filter(r => r.county === countyFilter);
    if (urgencyFilter) f = f.filter(r => r.urgency === urgencyFilter);
    if (verifFilter) f = f.filter(r => r.verification_status === verifFilter);
    if (channelFilter) f = f.filter(r => (r.channel ?? "web") === channelFilter);
    f.sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortField === "urgency") cmp = URGENCY_ORDER.indexOf(a.urgency as Urgency) - URGENCY_ORDER.indexOf(b.urgency as Urgency);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return f;
  }, [reports, countyFilter, urgencyFilter, verifFilter, channelFilter, sortField, sortDir]);

  const total = filtered.length;
  const pending = filtered.filter(r => r.verification_status === "pending").length;
  const immediate = filtered.filter(r => r.urgency === "immediate").length;
  const verified = filtered.filter(r => r.verification_status === "verified").length;
  const anonymous = filtered.filter(r => r.reporter_type === "anonymous").length;
  const authenticated = total - anonymous;
  const ussdCount = filtered.filter(r => r.channel === "ussd").length;

  const incidentCounts: Record<string, number> = {};
  filtered.forEach(r => (r.incident_types || []).forEach(t => incidentCounts[t] = (incidentCounts[t] || 0) + 1));
  const incidentBreakdown = Object.entries(incidentCounts).map(([k, v]) => ({ name: incidentLabel(k), count: v })).sort((a, b) => b.count - a.count).slice(0, 10);

  const countyCounts: Record<string, number> = {};
  filtered.forEach(r => { if (r.county) countyCounts[r.county] = (countyCounts[r.county] || 0) + 1; });
  const countyBreakdown = Object.entries(countyCounts).map(([k, v]) => ({ name: k, count: v })).sort((a, b) => b.count - a.count);

  const urgencyBreakdown = URGENCY_ORDER.map(u => ({ name: URGENCY_META[u].label, count: filtered.filter(r => r.urgency === u).length }));
  const verificationBreakdown = [
    { name: "Pending", count: filtered.filter(r => r.verification_status === "pending").length },
    { name: "Verified", count: filtered.filter(r => r.verification_status === "verified").length },
    { name: "Unverified", count: filtered.filter(r => r.verification_status === "unverified").length },
    { name: "Needs Info", count: filtered.filter(r => r.verification_status === "needs_more_info").length },
  ];

  const months: Record<string, { total: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.toLocaleString("en", { month: "short", year: "2-digit" })] = { total: 0 };
  }
  filtered.forEach(r => {
    const key = new Date(r.created_at).toLocaleString("en", { month: "short", year: "2-digit" });
    if (months[key]) months[key].total++;
  });
  const monthlyTrend = Object.entries(months).map(([month, v]) => ({ month, ...v }));

  const uniqueCounties = [...new Set(reports.map(r => r.county).filter(Boolean))].sort() as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Reporting dashboard</h1>
          <p className="text-muted text-sm">Every report that has reached the Hub, across web, USSD and mobile.</p>
        </div>
        <Button href="/report" size="sm" className="self-start sm:self-auto">
          <Plus className="w-4 h-4" />New report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Reports in total" value={total} icon={FileText} bg="bg-purple-050" ic="text-purple" />
        <StatCard label="Awaiting fact-check" value={pending} icon={Clock} bg="bg-amber-50" ic="text-amber-700" />
        <StatCard label="Marked immediate" value={immediate} icon={AlertTriangle} bg="bg-rose-50" ic="text-rose-600" />
        <StatCard label="Verified" value={verified} icon={CheckCircle} bg="bg-emerald-50" ic="text-emerald-700" />
        <StatCard label="Filed over USSD" value={ussdCount} icon={Smartphone} bg="bg-cyan-050" ic="text-cyan-700" />
        <StatCard label="Anonymous" value={anonymous} icon={Shield} bg="bg-magenta-050" ic="text-magenta-700" />
        <StatCard label="With an account" value={authenticated} icon={FileText} bg="bg-purple-050" ic="text-purple" />
      </div>

      {/* Filters */}
      <FilterBar
        filters={[
          { key: "county", label: "County", options: uniqueCounties.map((c) => ({ value: c, label: c })) },
          { key: "urgency", label: "Urgency", options: [{ value: "immediate", label: "Immediate" }, { value: "within_week", label: "Within a week" }, { value: "no_rush", label: "No rush" }] },
          { key: "verif", label: "Fact-check", options: [{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "unverified", label: "Could not verify" }, { value: "needs_more_info", label: "Needs more info" }] },
          { key: "channel", label: "Channel", options: [{ value: "web", label: "Web" }, { value: "ussd", label: "USSD" }, { value: "mobile", label: "Mobile" }, { value: "api", label: "Online listening" }] },
        ]}
        values={{ county: countyFilter, urgency: urgencyFilter, verif: verifFilter, channel: channelFilter }}
        onChange={(key, value) => ({ county: setCountyFilter, urgency: setUrgencyFilter, verif: setVerifFilter, channel: setChannelFilter } as Record<string, (v: string) => void>)[key]?.(value)}
        onClear={() => { setCountyFilter(""); setUrgencyFilter(""); setVerifFilter(""); setChannelFilter(""); }}
        trailing={
          <select value={sortField} onChange={(e) => { setSortField(e.target.value as "created_at" | "urgency"); setSortDir("desc"); }} aria-label="Sort" className="ml-auto h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-muted">
            <option value="created_at">Newest first</option>
            <option value="urgency">Most urgent first</option>
          </select>
        }
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Incidents by Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incidentBreakdown} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill={PURPLE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Anonymous vs Authenticated</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={[{ name: "Anonymous", value: anonymous }, { name: "Authenticated", value: authenticated }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {[0, 1].map(i => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Reports by County</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={countyBreakdown.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis width={44} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis width={44} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke={PURPLE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Urgency Levels</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={urgencyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis width={44} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {urgencyBreakdown.map((entry, i) => (
                  <Cell key={i} fill={urgencyHexByLabel(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-line p-5">
          <h3 className="font-black text-ink text-[15px] mb-4">Verification Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={verificationBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {verificationBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent reports */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">Recent reports</h2>
          <Link href="/hub/reporting/reports" className="text-sm font-semibold text-purple hover:underline">Open the full list →</Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
          {filtered.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-muted">No reports match these filters.</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.slice(0, 12).map((r) => <li key={r.id}><ReportRow r={r} /></li>)}
            </ul>
          )}
          {filtered.length > 12 && (
            <div className="border-t border-line px-4 py-2.5 text-center">
              <Link href="/hub/reporting/reports" className="text-xs font-semibold text-purple hover:underline">View all {filtered.length} reports →</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
