"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Signing in and signing up, on the server.
 *
 * These were client-side calls followed by a client-side navigation, and the
 * two raced: the browser writes the session cookie, the middleware reads it on
 * the server, and a navigation could arrive before the cookie did. The request
 * bounced back to /login and it looked as though the password was wrong. The
 * workaround was a full page load; this is the actual fix.
 *
 * A server action runs before the response is written, so the Set-Cookie and
 * the redirect leave together. There is no window in which the browser has
 * navigated but the server does not yet know who you are.
 *
 * Two other things follow from being here rather than in the browser:
 *
 *   The redirect target is validated server-side, where it cannot be skipped.
 *   `?next=` comes from a link somebody clicked and is attacker-controlled --
 *   see lib/safe-next.ts for why that matters on this platform in particular.
 *
 *   Next verifies the Origin against the Host on every server action, so these
 *   are not submittable from another site. A plain POST handler would have
 *   needed that built by hand.
 */

export interface AuthState {
  error?: string;
  /** Sign-up only: the account exists but the address needs confirming. */
  checkEmail?: boolean;
}

/**
 * What to say when sign-in fails.
 *
 * Wrong password and unknown address are deliberately given the same words:
 * telling somebody which one they got wrong tells an attacker whether an
 * address has an account here, and on this platform the mere fact that a woman
 * has an account is information worth protecting.
 *
 * `email_not_confirmed` is the exception and is surfaced plainly. It does admit
 * the account exists, but the alternative is somebody whose password is
 * perfectly correct being told it is wrong, for ever, with no way to work out
 * why. Sign-up already reveals the same fact, so nothing is lost by saying it.
 */
function readableError(code: string | undefined, message: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Those details did not match an account. Check the email and password and try again.";
    case "email_not_confirmed":
      return "Your email address has not been confirmed yet. Check your inbox for the confirmation link.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts just now. Please wait a minute and try again.";
    case "user_banned":
      return "This account is not available. Contact the Hub if you think that is a mistake.";
    case "weak_password":
      return "Please choose a longer password — at least eight characters.";
    case "user_already_exists":
      return "There is already an account with that email. Try signing in instead.";
    case "validation_failed":
      return "Please enter a valid email address.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: readableError(error.code, error.message) };
  }

  // Every layout reads the session, so the whole tree is stale now.
  revalidatePath("/", "layout");
  // redirect() signals by throwing, so it must be the last thing and must not
  // sit inside a try/catch that would swallow it.
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password) {
    return { error: "Enter your email and a password." };
  }
  if (password.length < 8) {
    return { error: "Please choose a password of at least eight characters." };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Carried into the profile by the handle_new_user trigger.
      data: { full_name: fullName, user_type: "defender" },
      // Absolute, and from configuration rather than from the request: a
      // confirmation link is emailed, so it cannot be relative, and it must not
      // be built from anything a caller controls.
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/onboarding`
        : undefined,
    },
  });

  if (error) {
    return { error: readableError(error.code, error.message) };
  }

  // With email confirmation on, there is no session yet — the person has to
  // follow the link. Say so rather than redirecting them into a wall.
  if (!data.session) {
    return { checkEmail: true };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

/**
 * Sign out, and land somewhere public.
 *
 * Also a server action so the cookie is cleared before the response, rather
 * than clearing it in the browser and hoping the next request agrees.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
