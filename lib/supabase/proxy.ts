import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

/**
 * Pages anybody may open without signing in. An entry covers the path itself
 * and everything beneath it; "/" covers only the home page.
 *
 * Access rules in the database are the real security boundary; this only
 * decides who gets bounced to the login page.
 */
const PUBLIC_PATHS = [
  "/", "/login", "/signup", "/auth", "/feed",
  "/blog", "/about", "/our-work", "/organizations", "/counties", "/contact",
  "/partners", "/activity-images", "/press", "/resources", "/newsletter", "/opportunities",
  "/privacy-policy", "/terms-of-use", "/data",
  // Recovering an account is something you do precisely because you cannot
  // sign in. Gating either page behind a session would make the whole flow
  // unreachable for the only people who need it.
  "/forgot-password", "/reset-password",
  // Reporting: filing a report must work without an account. The form creates
  // an anonymous credentialed account on submit, so gating this behind login
  // would defeat the purpose of the platform.
  "/report", "/offline", "/account-deleted", "/account-suspended",
  // Machine callers authenticate themselves inside the route handler:
  // Africa's Talking (USSD), Meta (signed webhook) and the chat assistant.
  "/api/ussd", "/api/meta", "/api/chat", "/api/cron", "/share-target",
  // Stored files. These objects are public by definition -- putting a session
  // check in front of them would hide published documents from the public they
  // were published for.
  "/files",
  // Edit mode for the public site checks the session itself and sends a signed-out
  // visitor to sign in with the way back here, so edit mode is on when they return.
  "/edit-site",
  // PWA plumbing.
  "/manifest.webmanifest", "/sw.js",
  // Crawlers must be able to read the rules without signing in.
  "/robots.txt",
];

// Neon Auth's guard: refreshes the session, finishes a Google sign-in when the
// browser comes back from it, and redirects signed-out visitors to /login.
// Built on first use so a missing variable cannot break module loading.
let guard: ((request: NextRequest) => Promise<NextResponse>) | null = null;

export async function updateSession(request: NextRequest) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    return NextResponse.next({ request });
  }
  guard ??= auth.middleware({ loginUrl: "/login", publicRoutes: PUBLIC_PATHS });

  const response = await guard(request);

  // Remember where the visitor was going, so signing in takes them there.
  const location = response.headers.get("location");
  if (location) {
    const target = new URL(location, request.url);
    if (target.pathname === "/login" && !target.searchParams.has("next")) {
      target.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(target, { headers: response.headers, status: response.status });
    }
  }
  return response;
}
