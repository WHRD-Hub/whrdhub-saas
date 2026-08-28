/**
 * Where a sign-in is allowed to send somebody afterwards.
 *
 * `?next=` is attacker-controlled: it arrives in a link, and people click links
 * that claim to be from us. Passed through unchecked it is an open redirect --
 * a phishing primitive, because the victim really does start on the Hub's own
 * login page, really does sign in, and only then lands somewhere else. On a
 * platform used by women documenting threats against them, sending one to a
 * page of somebody else's choosing is not a theoretical harm.
 *
 * So the rule is narrow and positive: a single-slash, same-origin path, and
 * nothing else. Anything unrecognised becomes the dashboard rather than an
 * error, because a mangled `next` is not worth blocking a legitimate sign-in.
 *
 * The cases this exists to stop:
 *   //evil.com          protocol-relative -- the browser reads it as a host
 *   /\evil.com          backslash, which some browsers normalise to //
 *   https://evil.com    absolute
 *   javascript:...      a scheme rather than a path
 */
export const DEFAULT_NEXT = "/dashboard";

/** Whitespace and control characters, which can smuggle a scheme past a naive check. */
const UNSAFE_CHARS = /[\s\u0000-\u001f\u007f]/;

export function safeNext(raw: unknown, fallback: string = DEFAULT_NEXT): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (UNSAFE_CHARS.test(raw)) return fallback;

  // It must be a path: not a host, not a scheme.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // And it must still be same-origin once a browser has parsed it.
  try {
    const url = new URL(raw, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;

    // Re-serialise from the parsed parts rather than returning the input, so an
    // encoded separator cannot survive into the redirect.
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
