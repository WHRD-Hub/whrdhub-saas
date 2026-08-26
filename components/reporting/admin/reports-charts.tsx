"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const PURPLE = "hsl(271, 76%, 31%)";
const GOLD = "hsl(39, 78%, 46%)";
const COLORS = [PURPLE, GOLD, "#10b981", "#3b82f6", "#f43f5e", "#8b5cf6", "#f97316", "#06b6d4"];

interface ChartData {
  incidentBreakdown: { name: string; count: number }[];
  countyBreakdown: { name: string; count: number }[];
  urgencyBreakdown: { name: string; count: number }[];
  verificationBreakdown: { name: string; count: number }[];
  reporterTypeBreakdown: { name: string; value: number }[];
  monthlyTrend: { month: string; anonymous: number; authenticated: number }[];
  attackNatureBreakdown?: { name: string; count: number }[];
  derogatoryWordBreakdown?: { name: string; count: number }[];
}

export function ReportsCharts({ data }: { data: ChartData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Incident types bar chart */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Incidents by Type</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.incidentBreakdown} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip />
            <Bar dataKey="count" fill={PURPLE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reporter type pie */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Anonymous vs Authenticated Reports</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data.reporterTypeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.reporterTypeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* County breakdown */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Reports by County</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.countyBreakdown.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly trend */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Monthly Trend (Anonymous vs Authenticated)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="anonymous" stroke={PURPLE} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="authenticated" stroke={GOLD} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Urgency breakdown */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Urgency Levels</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.urgencyBreakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.urgencyBreakdown.map((entry, i) => (
                <Cell key={i} fill={entry.name === "Immediate" ? "#ef4444" : entry.name === "Within Week" ? GOLD : "#10b981"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Verification status */}
      <div className="bg-white rounded-xl border border-line p-5">
        <h3 className="font-bold text-sm mb-4">Fact-Check / Verification Status</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data.verificationBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0)*100).toFixed(0)}%`}>
              {data.verificationBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Attack nature */}
      {data.attackNatureBreakdown && data.attackNatureBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-line p-5">
          <h3 className="font-bold text-sm mb-4">Attack Nature Classification</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.attackNatureBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0)*100).toFixed(0)}%`}>
                {data.attackNatureBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top derogatory words */}
      {data.derogatoryWordBreakdown && data.derogatoryWordBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-line p-5 lg:col-span-2">
          <h3 className="font-bold text-sm mb-1">Top Derogatory Words / Hate Speech Terms</h3>
          <p className="text-xs text-muted mb-4">Frequency of hate speech terms logged by admins during fact-checking</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.derogatoryWordBreakdown.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
