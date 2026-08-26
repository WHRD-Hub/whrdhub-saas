"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ChevronRight, Check, X, Clock } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/**
 * A run-it-yourself model of how a report reaches a support service.
 *
 * The live matcher (`match_report_services()`) is a database function, which
 * means the only way to see what it does is to file a report and read a table
 * afterwards. That is a bad way to explain a system to the people accountable
 * for it, so this walks the same pipeline one stage at a time on a worked
 * example: the candidate pool, the filters that eliminate, the points each
 * stage adds or removes, the cut, and then the state machine the referral
 * enters once a proposal has actually gone out.
 *
 * Nothing here writes to the database. It is a teaching surface for
 * coordinators and a sanity check for whoever tunes the weights: the numbers
 * below are the ones the SQL uses, so if the two drift apart it shows.
 *
 * Deliberately built with no charting or graph library — the Hub ships no
 * dependency it cannot audit, and CSS does this fine.
 */

type Category = "legal" | "medical" | "psychosocial" | "shelter" | "police";

interface Candidate {
  id: string;
  name: string;
  org: string;
  category: Category;
  county: string;
  national: boolean;
  /** Cases already open. Load balancing reads this. */
  activeCases: number;
  verified: boolean;
  /** Notes shown when a hard filter eliminates the candidate. */
  eliminated?: string;
}

interface Scenario {
  id: string;
  title: string;
  blurb: string;
  county: string;
  urgency: "immediate" | "within_week" | "no_rush";
  needs: Category[];
  incident: string;
  candidates: Candidate[];
}

/* ── The worked examples ──────────────────────────────────────────────── */

const SCENARIOS: Scenario[] = [
  {
    id: "nairobi-urgent",
    title: "Immediate threat, Nairobi",
    blurb:
      "A defender reports physical assault and says she is not safe tonight. Services exist in her county, so the match should be local and fast.",
    county: "Nairobi",
    urgency: "immediate",
    needs: ["medical", "shelter", "legal"],
    incident: "physical_assault",
    candidates: [
      { id: "c1", name: "Nairobi Women's Hospital GVRC", org: "GVRC", category: "medical", county: "Nairobi", national: false, activeCases: 1, verified: true },
      { id: "c2", name: "Usalama Safe House", org: "Usalama", category: "shelter", county: "Nairobi", national: false, activeCases: 0, verified: true },
      { id: "c3", name: "FIDA Kenya Legal Aid", org: "FIDA", category: "legal", county: "Nairobi", national: true, activeCases: 3, verified: true },
      { id: "c4", name: "Kisumu Counselling Centre", org: "KCC", category: "psychosocial", county: "Kisumu", national: false, activeCases: 0, verified: true },
      { id: "c5", name: "Rapid Response Legal Desk", org: "RRLD", category: "legal", county: "Nairobi", national: false, activeCases: 5, verified: true },
      { id: "c6", name: "Unverified Community Clinic", org: "—", category: "medical", county: "Nairobi", national: false, activeCases: 0, verified: false },
    ],
  },
  {
    id: "turkana-thin",
    title: "Thin coverage, Turkana",
    blurb:
      "The same engine where almost nothing is local. Watch the cascade widen: national providers carry the case rather than leaving it unmatched.",
    county: "Turkana",
    urgency: "within_week",
    needs: ["legal", "psychosocial"],
    incident: "online_harassment",
    candidates: [
      { id: "d1", name: "FIDA Kenya Legal Aid", org: "FIDA", category: "legal", county: "Nairobi", national: true, activeCases: 2, verified: true },
      { id: "d2", name: "Lodwar Paralegal Network", org: "LPN", category: "legal", county: "Turkana", national: false, activeCases: 0, verified: true },
      { id: "d3", name: "Befrienders Kenya", org: "Befrienders", category: "psychosocial", county: "Nairobi", national: true, activeCases: 1, verified: true },
      { id: "d4", name: "Mombasa Trauma Unit", org: "MTU", category: "psychosocial", county: "Mombasa", national: false, activeCases: 0, verified: true },
      { id: "d5", name: "Eldoret Shelter", org: "ESH", category: "shelter", county: "Uasin Gishu", national: false, activeCases: 0, verified: true },
    ],
  },
];

/* ── The pipeline ─────────────────────────────────────────────────────── */

interface StageResult {
  delta: number;
  why: string;
}

interface Stage {
  key: string;
  name: string;
  detail: string;
  /** null = candidate is untouched by this stage. */
  score: (c: Candidate, s: Scenario) => StageResult | null;
  /** A hard filter removes candidates instead of scoring them. */
  eliminates?: (c: Candidate, s: Scenario) => string | null;
}

const STAGES: Stage[] = [
  {
    key: "pool",
    name: "Candidate pool",
    detail:
      "Every active service in the directory starts here. Nothing is scored yet — this is only the set the engine is allowed to consider.",
    score: () => null,
  },
  {
    key: "filters",
    name: "Hard filters",
    detail:
      "Elimination, not scoring. An unverified service never receives a survivor. A service already carrying five open cases is at capacity, and adding a sixth helps nobody.",
    score: () => null,
    eliminates: (c) => {
      if (!c.verified) return "Not verified";
      if (c.activeCases >= 5) return "At capacity (5 open cases)";
      return null;
    },
  },
  {
    key: "relevance",
    name: "Service relevance",
    detail:
      "Does what this service does answer what was reported? A service outside the need is not a weaker match, it is the wrong one — so the floor is set here.",
    score: (c, s) => {
      const i = s.needs.indexOf(c.category);
      if (i === 0) return { delta: 45, why: "Primary need" };
      if (i > 0) return { delta: 30, why: "Secondary need" };
      return { delta: 0, why: "Outside the reported need" };
    },
  },
  {
    key: "proximity",
    name: "Proximity",
    detail:
      "Distance is a real barrier to a person with no fare. A local service scores highest, a national one still counts, and one in a county she cannot reach is scored honestly low rather than hidden.",
    score: (c, s) => {
      if (c.county === s.county) return { delta: 35, why: `Based in ${s.county}` };
      if (c.national) return { delta: 15, why: "National coverage" };
      return { delta: -10, why: `Only operates in ${c.county}` };
    },
  },
  {
    key: "urgency",
    name: "Urgency weighting",
    detail:
      "An immediate threat is not a queue position. Urgent reports lift every surviving candidate so the case clears triage first.",
    score: (c, s) => {
      if (s.urgency === "immediate") return { delta: 15, why: "Immediate threat" };
      if (s.urgency === "within_week") return { delta: 5, why: "Within the week" };
      return { delta: 0, why: "No rush stated" };
    },
  },
  {
    key: "load",
    name: "Load balancing",
    detail:
      "Case volume is spread deliberately. An idle service is rewarded and a busy one is penalised, because a referral to an overloaded desk is a referral that goes quiet.",
    score: (c) => {
      if (c.activeCases === 0) return { delta: 12, why: "No open cases" };
      return { delta: -6 * c.activeCases, why: `${c.activeCases} open case${c.activeCases > 1 ? "s" : ""}` };
    },
  },
  {
    key: "select",
    name: "Selection",
    detail:
      "Everything scoring 30 or better is proposed, up to three services. If nothing clears the bar the engine widens rather than giving up: the top national candidate is proposed and flagged as a fallback, because an imperfect referral beats a dead case.",
    score: () => null,
  },
];

const THRESHOLD = 30;
const MAX_MATCHES = 3;

interface Scored extends Candidate {
  score: number;
  trail: { stage: string; delta: number; why: string }[];
  out?: string;
  selected?: boolean;
  fallback?: boolean;
}

function runTo(s: Scenario, stageIndex: number): Scored[] {
  const rows: Scored[] = s.candidates.map((c) => ({ ...c, score: 0, trail: [] }));

  for (let i = 0; i <= stageIndex && i < STAGES.length; i++) {
    const stage = STAGES[i];
    for (const r of rows) {
      if (r.out) continue;
      if (stage.eliminates) {
        const why = stage.eliminates(r, s);
        if (why) {
          r.out = why;
          continue;
        }
      }
      const res = stage.score(r, s);
      if (res) {
        r.score += res.delta;
        r.trail.push({ stage: stage.name, delta: res.delta, why: res.why });
      }
    }
  }

  if (stageIndex >= STAGES.length - 1) {
    const live = rows.filter((r) => !r.out).sort((a, b) => b.score - a.score);
    const above = live.filter((r) => r.score >= THRESHOLD).slice(0, MAX_MATCHES);
    if (above.length) {
      for (const r of above) r.selected = true;
    } else if (live.length) {
      live[0].selected = true;
      live[0].fallback = true;
    }
  }

  return rows;
}

/* ── The component ────────────────────────────────────────────────────── */

export function MatchSimulation() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const rows = useMemo(() => runTo(scenario, stage), [scenario, stage]);
  const done = stage >= STAGES.length - 1;

  const reset = useCallback((id?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setPlaying(false);
    setStage(0);
    if (id) setScenarioId(id);
  }, []);

  // Derived rather than stored: the run stops because there is no stage left,
  // not because an effect reached back and switched a flag off.
  const running = playing && !done;

  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => setStage((s) => s + 1), 1400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [running, stage]);

  const ordered = [...rows].sort((a, b) => {
    if (!!a.out !== !!b.out) return a.out ? 1 : -1;
    return b.score - a.score;
  });
  const max = Math.max(60, ...rows.map((r) => r.score));

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
      {/* Scenario picker */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => reset(s.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              s.id === scenarioId
                ? "border-purple bg-purple text-white"
                : "border-line text-muted hover:border-purple/40 hover:text-ink",
            )}
          >
            {s.title}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => (done ? reset() : setPlaying((p) => !p))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
          >
            {done ? <><RotateCcw className="h-3.5 w-3.5" /> Run again</>
              : running ? <><Pause className="h-3.5 w-3.5" /> Pause</>
              : <><Play className="h-3.5 w-3.5" /> Run</>}
          </button>
          <button
            type="button"
            disabled={done}
            onClick={() => setStage((s) => Math.min(STAGES.length - 1, s + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-40"
          >
            Step <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-line bg-paper px-4 py-3">
        <p className="text-sm text-ink">{scenario.blurb}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Pill tone="purple">{scenario.county}</Pill>
          <Pill tone={scenario.urgency === "immediate" ? "red" : "slate"}>
            {scenario.urgency.replace(/_/g, " ")}
          </Pill>
          <Pill tone="slate">{scenario.incident.replace(/_/g, " ")}</Pill>
          <Pill tone="cyan">needs: {scenario.needs.join(", ")}</Pill>
        </div>
      </div>

      {/* Stage rail */}
      <div className="flex gap-1 overflow-x-auto border-b border-line p-4">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setPlaying(false); setStage(i); }}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors",
              i === stage
                ? "border-purple bg-purple-050 text-purple-700"
                : i < stage
                  ? "border-line bg-surface text-muted"
                  : "border-dashed border-line text-muted/60",
            )}
          >
            <span className="block text-[10px] font-black tracking-wide opacity-60">
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.name}
          </button>
        ))}
      </div>

      <p className="border-b border-line px-4 py-3 text-sm text-muted">
        <span className="font-semibold text-ink">{STAGES[stage].name}.</span>{" "}
        {STAGES[stage].detail}
      </p>

      {/* Candidates */}
      <ul className="divide-y divide-line">
        {ordered.map((r) => {
          const last = r.trail[r.trail.length - 1];
          return (
            <li
              key={r.id}
              className={cn(
                "px-4 py-3 transition-opacity duration-500",
                r.out && "opacity-45",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">{r.name}</span>
                <span className="text-xs text-muted">{r.category}</span>
                <span className="text-xs text-muted">·</span>
                <span className="text-xs text-muted">
                  {r.county}
                  {r.national ? " (national)" : ""}
                </span>
                {r.out && <Pill tone="red">Filtered out — {r.out}</Pill>}
                {r.selected && !r.fallback && <Pill tone="green">Proposed</Pill>}
                {r.fallback && <Pill tone="amber">Proposed — fallback</Pill>}
                <span className="ml-auto font-mono text-sm font-black text-ink">
                  {r.out ? "—" : r.score}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    r.out ? "bg-slate-300"
                      : r.selected ? "bg-emerald-500"
                      : r.score >= THRESHOLD ? "bg-purple"
                      : "bg-amber-400",
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, (r.score / max) * 100))}%` }}
                />
              </div>

              {!r.out && last && (
                <p className="mt-1.5 text-xs text-muted">
                  <span className={cn("font-bold", last.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {last.delta >= 0 ? "+" : ""}{last.delta}
                  </span>{" "}
                  {last.why} <span className="opacity-60">({last.stage})</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {done && <Outcome rows={rows} />}
    </div>
  );
}

/* ── What happens after a proposal goes out ───────────────────────────── */

const AFTER = [
  {
    icon: Clock,
    tone: "amber" as const,
    title: "No response yet",
    body: "The proposal is out and neither side has moved. This is the state a coordinator watches: a case can sit here silently, and after 24 hours it is flagged as stale on the dashboard above.",
  },
  {
    icon: Check,
    tone: "cyan" as const,
    title: "Service accepted",
    body: "The support service has taken the case and is waiting on the survivor to confirm. Nobody is chasing her — the referral simply stays open on her report until she is ready.",
  },
  {
    icon: Check,
    tone: "green" as const,
    title: "Both accepted",
    body: "She confirmed. Both sides are engaged and the report moves to referred. Her acceptance is the one that counts — a service cannot mark itself as helping her.",
  },
  {
    icon: X,
    tone: "red" as const,
    title: "Declined",
    body: "One side said no, with a reason where they gave one. The case returns to the pool and can be re-matched from the report page.",
  },
];

function Outcome({ rows }: { rows: Scored[] }) {
  const picked = rows.filter((r) => r.selected);
  return (
    <div className="border-t border-line bg-paper p-4">
      <h3 className="text-sm font-black text-ink">
        {picked.length} referral{picked.length === 1 ? "" : "s"} would be created
      </h3>
      <p className="mt-1 text-sm text-muted">
        Each one enters the state machine below at <strong className="text-ink">proposed</strong>.
        Matching runs the moment a report is filed — it does not wait on a fact-check, because
        somebody describing an immediate threat should not be told to come back later.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {AFTER.map((a) => (
          <div key={a.title} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <a.icon className="h-4 w-4 text-muted" />
              <Pill tone={a.tone}>{a.title}</Pill>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
