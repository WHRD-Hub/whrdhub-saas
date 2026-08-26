/**
 * The states a referral moves through, and how each one reads.
 *
 * Shared by the reporting console, the survivor's own report page and the
 * matching simulation so the same match never gets described two ways.
 */

export type MatchState =
  | "proposed"
  | "provider_accepted"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled";

export type Tone = "amber" | "green" | "red" | "slate" | "purple" | "cyan" | "magenta";

export interface MatchMeta {
  /** What a coordinator sees. */
  label: string;
  tone: Tone;
  /** What the survivor sees. The same fact, said to the person it happened to. */
  survivorLabel: string;
  /** One line of what it means, for the console. */
  detail: string;
  /** Whether this state is waiting on somebody to act. */
  waiting: "nobody" | "survivor" | "service";
}

export const MATCH_META: Record<MatchState, MatchMeta> = {
  proposed: {
    label: "No response yet",
    tone: "amber",
    survivorLabel: "Support offered",
    detail: "Matched to the service. Neither side has responded.",
    waiting: "service",
  },
  provider_accepted: {
    label: "Service accepted",
    tone: "cyan",
    survivorLabel: "Ready when you are",
    detail: "The service has accepted and is waiting on the survivor to confirm.",
    waiting: "survivor",
  },
  accepted: {
    label: "Both accepted",
    tone: "green",
    survivorLabel: "Connected",
    detail: "The survivor and the service are both engaged.",
    waiting: "nobody",
  },
  declined: {
    label: "Declined",
    tone: "red",
    survivorLabel: "Not taken up",
    detail: "One side turned the referral down. The case needs another service.",
    waiting: "nobody",
  },
  completed: {
    label: "Completed",
    tone: "slate",
    survivorLabel: "Completed",
    detail: "The support was delivered and the referral is closed.",
    waiting: "nobody",
  },
  cancelled: {
    label: "Cancelled",
    tone: "slate",
    survivorLabel: "Cancelled",
    detail: "Withdrawn, usually at the survivor's request.",
    waiting: "nobody",
  },
};

export function matchMeta(state: string | null | undefined): MatchMeta {
  return MATCH_META[(state as MatchState) ?? "proposed"] ?? MATCH_META.proposed;
}

/**
 * The one-line summary of a whole report's referrals.
 *
 * A report can hold several, so the console needs a single honest headline.
 * Live engagement outranks a service's yes, which outranks silence — the state
 * furthest along is the one worth reporting.
 */
export function summariseReport(states: string[]): {
  label: string;
  tone: Tone;
  waiting: boolean;
} {
  if (states.length === 0) {
    return { label: "Not matched", tone: "slate", waiting: false };
  }
  if (states.includes("accepted")) return { label: "Both accepted", tone: "green", waiting: false };
  if (states.includes("provider_accepted")) {
    return { label: "Awaiting survivor", tone: "cyan", waiting: true };
  }
  if (states.includes("proposed")) {
    return { label: "No response yet", tone: "amber", waiting: true };
  }
  if (states.every((s) => s === "completed")) {
    return { label: "Completed", tone: "slate", waiting: false };
  }
  if (states.includes("declined")) return { label: "Declined", tone: "red", waiting: false };
  return { label: "Matched", tone: "purple", waiting: false };
}
