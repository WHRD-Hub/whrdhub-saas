import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { EDIT_COOKIE } from "@/lib/site-content-store";
import { safeNext } from "@/lib/safe-next";

/**
 * The way into edit mode for the public website. Opens the page (the home page by
 * default, or ?next=/about) with edit mode on.
 *
 * Needed because a signed-in administrator who opens the home page is sent on to
 * the Hub console, so the "Edit this page" button there is never seen. With edit
 * mode on, the home page stays put (see app/page.tsx).
 */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/");
  const user = await getCurrentUser();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/edit-site${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
    return NextResponse.redirect(login);
  }
  // Only a Hub super administrator; everyone else just sees the page.
  if (!user.profile?.is_hub_admin || user.isDeleted || user.isBanned) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const res = NextResponse.redirect(new URL(next, request.url));
  res.cookies.set(EDIT_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
