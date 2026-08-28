import { safeNext } from "../lib/safe-next.ts";

const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

const cases = [
  // Legitimate destinations must survive untouched.
  ["/dashboard", "/dashboard"],
  ["/hub/reporting/reports?page=2", "/hub/reporting/reports?page=2"],
  ["/dashboard/write/abc#top", "/dashboard/write/abc#top"],
  ["/login?next=/hub", "/login?next=/hub"],

  // Open-redirect attempts must all collapse to the default.
  ["//evil.com", "/dashboard"],
  ["///evil.com", "/dashboard"],
  ["/\\evil.com", "/dashboard"],
  ["/\\\\evil.com", "/dashboard"],
  ["https://evil.com", "/dashboard"],
  ["http://evil.com", "/dashboard"],
  ["javascript:alert(1)", "/dashboard"],
  ["data:text/html,<script>", "/dashboard"],
  ["/" + TAB + "/evil.com", "/dashboard"],
  ["/" + NL + "/evil.com", "/dashboard"],
  ["/" + NUL + "evil", "/dashboard"],
  [" //evil.com", "/dashboard"],
  // Encoded slashes stay encoded: the browser does not decode %2f when working
  // out the origin, so this navigates to a path on our own host and is safe.
  // Rejecting it would break legitimate paths that contain encoded characters.
  ["/%2f%2fevil.com", "/%2f%2fevil.com"],

  // Junk of every shape.
  ["", "/dashboard"],
  [null, "/dashboard"],
  [undefined, "/dashboard"],
  [123, "/dashboard"],
  [{}, "/dashboard"],
  ["dashboard", "/dashboard"],
];

let failures = 0;
for (const [input, want] of cases) {
  const got = safeNext(input);
  const ok = got === want;
  if (!ok) failures++;
  const shown = JSON.stringify(input);
  console.log(
    `${ok ? "pass" : "FAIL"}  ${String(shown).padEnd(30)} -> ${JSON.stringify(got)}` +
      (ok ? "" : `   want ${JSON.stringify(want)}`),
  );
}
console.log(failures ? `\n${failures} FAILURES` : `\nall ${cases.length} pass`);
process.exitCode = failures ? 1 : 0;
