import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
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
          .select("hub_onboarded, welcomed_at, full_name")
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

        const dest = profile?.hub_onboarded ? next : "/onboarding";
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
