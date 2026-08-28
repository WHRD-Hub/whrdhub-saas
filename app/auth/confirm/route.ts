import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Email one-time-token confirmation (sign-up confirm, magic link, password
 * recovery). Ported from the reporting platform; it now shares the merged
 * app's Supabase server client and sends failures to the single /login page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Validated, not trusted. Built into `${origin}${next}` below, a value of
  // "//evil.com" would have produced a protocol-relative URL and sent somebody
  // who had just signed in to another site entirely.
  const next = safeNext(searchParams.get("next"));

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (!token_hash || !type) return fail("This confirmation link is incomplete.");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return fail(error.message);

  // Behind a proxy the request origin is the internal host, so prefer the
  // forwarded host when one is present.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

  // A recovery link has one job: get her to the page where she sets a new
  // password. Diverting it into onboarding -- which is what happened to any
  // recovery for an account that had not finished onboarding -- leaves her
  // signed in with the old password still in force and no way to change it.
  if (type === "recovery") {
    return NextResponse.redirect(`${base}/reset-password`);
  }

  // Send people who have not finished Hub onboarding through it first.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("hub_onboarded")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.hub_onboarded) return NextResponse.redirect(`${base}/onboarding`);
  }

  return NextResponse.redirect(`${base}${next}`);
}
