import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext, DEFAULT_NEXT } from "@/lib/safe-next";
import { isStaffProfile, STAFF_HOME } from "@/lib/staff-landing";
import { sendMail } from "@/lib/email/send";
import { welcomeHtml, welcomeText, welcomeSubject } from "@/lib/email/welcome";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `code`
 * that we exchange for a session, then send the user on to onboarding (if they
 * have not completed it) or the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validated, not trusted. Built into `${origin}${next}` below, a value of
  // "//evil.com" would have produced a protocol-relative URL and sent somebody
  // who had just signed in to another site entirely.
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("hub_onboarded, welcomed_at, full_name, user_type, is_hub_admin")
          .eq("id", user.id)
          .maybeSingle();

        // Somebody who signs in with Google is sent nothing by Supabase: the
        // provider has already vouched for the address, so there is no
        // confirmation email and no record in her inbox that the account
        // exists. Send one, once. Marked before sending rather than after, so
        // a slow provider and a refreshed page cannot produce two.
        if (profile && !profile.welcomed_at && user.email) {
          await supabase
            .from("profiles")
            .update({ welcomed_at: new Date().toISOString() })
            .eq("id", user.id);
          void sendWelcome(user.email, (profile.full_name as string) ?? null);
        }

        // Staff skip member onboarding and open the console by default.
        const staff = isStaffProfile(profile);
        // Someone who chose "just report" lands on their reports and is never pushed through chapter onboarding.
        const reporterChoice = next.startsWith("/dashboard/reports");
        if (reporterChoice && !staff && !profile?.hub_onboarded) {
          // Best effort: Google sign-ups carry no kind of their own, so record the choice.
          await supabase.from("profiles").update({ account_kind: "reporter" }).eq("id", user.id);
        }
        const dest = staff
          ? (next === DEFAULT_NEXT ? STAFF_HOME : next)
          : profile?.hub_onboarded || reporterChoice ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${dest}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}


/**
 * Fire-and-forget: a welcome email must never delay or fail a sign-in.
 *
 * Deliberately not awaited by the caller. If it fails, it is logged inside
 * sendMail and the person is already where she was going.
 */
async function sendWelcome(email: string, name: string | null) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  if (!site) return;
  await sendMail({
    to: email,
    subject: welcomeSubject(),
    html: welcomeHtml(name, site),
    text: welcomeText(name, site),
  });
}
