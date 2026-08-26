"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle, AlertTriangle, Shield, Plus, ExternalLink, ArrowUpDown, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  perpetrator_type?: string | null;
  channel?: string | null;
}

const CHANNEL_BADGE: Record<string, "secondary" | "info" | "success" | "warning"> = {
  web: "secondary", ussd: "warning", api: "info", mobile: "success",
};

const PURPLE = "#734e9e";
const GOLD = "#ce2087";
const COLORS = [PURPLE, GOLD, "#10b981", "#3b82f6", "#f43f5e", "#8b5cf6", "#f97316", "#06b6d4"];

const URGENCY_ORDER = ["immediate", "within_week", "no_rush"];
const URGENCY_LABELS: Record<string, string> = { immediate: "Immediate", within_week: "Within Week", no_rush: "No Rush" };

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

const STATUS_BADGE: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  submitted: "secondary", under_review: "info", referred: "success", closed: "secondary", flagged: "destructive",
};
const URGENCY_BADGE: Record<string, "destructive" | "warning" | "secondary"> = {
  immediate: "destructive", within_week: "warning", no_rush: "secondary",
};
const VERIF_BADGE: Record<string, "info" | "success" | "destructive" | "warning" | "secondary"> = {
  pending: "info", verified: "success", unverified: "destructive", needs_more_info: "warning",
};

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
      if (sortField === "urgency") cmp = URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency);
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
  const incidentBreakdown = Object.entries(incidentCounts).map(([k, v]) => ({ name: k.replace(/_/g, " "), count: v })).sort((a, b) => b.count - a.count).slice(0, 10);

  const countyCounts: Record<string, number> = {};
  filtered.forEach(r => { if (r.county) countyCounts[r.county] = (countyCounts[r.county] || 0) + 1; });
  const countyBreakdown = Object.entries(countyCounts).map(([k, v]) => ({ name: k, count: v })).sort((a, b) => b.count - a.count);

  const urgencyBreakdown = URGENCY_ORDER.map(u => ({ name: URGENCY_LABELS[u] || u, count: filtered.filter(r => r.urgency === u).length }));
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

  const toggleSort = (field: "created_at" | "urgency") => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

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
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">County</label>
          <select value={countyFilter} onChange={e => setCountyFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30">
            <option value="">All counties</option>
            {uniqueCounties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Urgency</label>
          <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30">
            <option value="">All</option>
            <option value="immediate">Immediate</option>
            <option value="within_week">Within Week</option>
            <option value="no_rush">No Rush</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Fact-Check</label>
          <select value={verifFilter} onChange={e => setVerifFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="needs_more_info">Needs More Info</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Channel</label>
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30">
            <option value="">All channels</option>
            <option value="web">Web</option>
            <option value="ussd">USSD</option>
            <option value="mobile">Mobile</option>
            <option value="api">API</option>
          </select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setCountyFilter(""); setUrgencyFilter(""); setVerifFilter(""); setChannelFilter(""); }}>
          Clear filters
        </Button>
      </div>

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
              <YAxis tick={{ fontSize: 11 }} />
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
              <YAxis tick={{ fontSize: 11 }} />
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
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {urgencyBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.name === "Immediate" ? "#ef4444" : entry.name === "Within Week" ? GOLD : "#10b981"} />
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

      {/* Reports table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-ink">All Reports</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/hub/reporting/reports"><ExternalLink className="w-3.5 h-3.5 mr-1.5" />Full report list</Link>
          </Button>
        </div>
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Incident</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">County</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <button onClick={() => toggleSort("urgency")} className="flex items-center gap-1 hover:text-ink">
                      Urgency <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Fact-Check</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Reporter</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted">No reports match current filters</td></tr>
                ) : filtered.slice(0, 20).map(r => (
                  <tr key={r.id} className="transition-colors hover:bg-paper">
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.incident_types || []).slice(0, 2).map(t => (
                          <span key={t} className="text-xs bg-paper px-1.5 py-0.5 rounded text-muted capitalize">{t.replace(/_/g, " ")}</span>
                        ))}
                        {(r.incident_types || []).length > 2 && <span className="text-xs text-muted">+{(r.incident_types || []).length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{r.county || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={URGENCY_BADGE[r.urgency] || "secondary"}>{r.urgency?.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[r.status] || "secondary"}>{r.status?.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={VERIF_BADGE[r.verification_status] || "secondary"}>{r.verification_status?.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={CHANNEL_BADGE[r.channel ?? "web"] || "secondary"} className="uppercase">{r.channel ?? "web"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.reporter_type === "anonymous" ? "outline" : "info"}>{r.reporter_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/hub/reporting/reports/${r.id}`}><ExternalLink className="w-3.5 h-3.5" /></Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 20 && (
            <div className="px-4 py-3 border-t border-line text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/hub/reporting/reports">View all {filtered.length} reports →</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
