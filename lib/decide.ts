/**
 * Typed decisions from TypeSafe's Jev (System One). Give it some text and a
 * question with a fixed set of answers; it returns one of them with
 * probabilities, in a single fast pass and without writing prose. The right tool
 * for "which of these is it" and "yes or no". The wrong one for writing,
 * arithmetic or counting.
 *
 * Jev is reached through OpenRouter (OPENROUTER_API_KEY), with TypeSafe's own
 * API (TYPESAFE_API_KEY) as the spare. Only Jev is ever asked: no general
 * language model is used here. When neither route answers, every function
 * returns null and the caller keeps using its own rule. Nothing here may be
 * required for a page to work.
 *
 * Privacy: text sent here leaves our servers. Public posts from social media are
 * fine. A reporter's private report is not, and is only ever sent when
 * JEV_PRIVATE_REPORTS=on has been set on purpose (see jevMayReadReports).
 */

export interface Choice<K extends string> {
  choice: K;
  probability: number;
  confidence: number;
  probabilities: Record<string, number>;
}

const jevKey = () => process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || "";
const routerKey = () => process.env.OPENROUTER_API_KEY || "";

/** True when Jev can be asked anything at all (through OpenRouter, or TypeSafe's own API). */
export const decideConfigured = () => !!(routerKey() || jevKey());

/** Private reports are sent to Jev only on an explicit, deliberate opt-in. */
export const jevMayReadReports = () => decideConfigured() && (process.env.JEV_PRIVATE_REPORTS ?? "").toLowerCase() === "on";

interface Answer { choice: string; probabilities: Record<string, number>; confidence: number }

/** One System One call. The two routes differ only in URL, key, model name and how the state is wrapped. */
async function call(url: string, key: string, model: string, state: unknown, instructions: string, criteria: Record<string, string>): Promise<Answer | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, state, questions: { q: { type: "choice", instructions, criteria } } }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { answers?: { q?: { choice?: string; probabilities?: Record<string, number>; confidence?: number } } };
    const a = j.answers?.q;
    if (!a?.choice || !(a.choice in criteria)) return null;
    return { choice: a.choice, probabilities: a.probabilities ?? {}, confidence: a.confidence ?? a.probabilities?.[a.choice] ?? 0 };
  } catch {
    return null;
  }
}

/** OpenRouter first (Jev is served there as typesafe/jev); TypeSafe's own API is the spare. */
async function ask(state: string, instructions: string, criteria: Record<string, string>): Promise<Answer | null> {
  const text = state.slice(0, 24_000);
  const viaRouter = routerKey();
  if (viaRouter) {
    // The router occasionally times out or rate-limits under a burst; one more try fixes most of those.
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await call("https://openrouter.ai/api/alpha/decisions", viaRouter, process.env.JEV_MODEL || "typesafe/jev-1.13", { text }, instructions, criteria);
      if (r) return r;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  const direct = jevKey();
  if (direct) return call("https://api.typesafe.ai/v1/systemone", direct, process.env.JEV_MODEL_DIRECT || "jev-latest", text, instructions, criteria);
  return null;
}

/** Pick one of the given answers. Null when Jev is not configured or did not answer. */
export async function decideChoice<K extends string>(
  state: string,
  instructions: string,
  options: Record<K, string>,
): Promise<Choice<K> | null> {
  const r = await ask(state, instructions, options);
  if (!r || !(r.choice in options)) return null;
  return { choice: r.choice as K, probability: r.probabilities[r.choice] ?? r.confidence, confidence: r.confidence, probabilities: r.probabilities };
}

/** Yes or no, with a probability for yes. */
export async function decideYesNo(
  state: string,
  question: string,
  yes: string,
  no: string,
): Promise<{ yes: boolean; probability: number } | null> {
  const r = await decideChoice(state, question, { yes, no });
  if (!r) return null;
  const p = r.probabilities.yes ?? (r.choice === "yes" ? r.probability : 1 - r.probability);
  return { yes: r.choice === "yes", probability: p };
}
