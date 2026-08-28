/**
 * Sending an email from the app. Server-side only: it reads a secret from
 * the environment and must never be imported into a client component.
 *
 * Almost every message in this product comes from Supabase's auth server:
 * confirmation, recovery, email change. Those are configured in the Supabase
 * dashboard and nothing here is involved. This exists for the one case Supabase
 * has no opinion about — somebody who signs in with Google is never sent
 * anything at all, because the provider has already vouched for the address,
 * so nothing would otherwise greet her.
 *
 * Mailtrap's HTTP API rather than SMTP: a serverless function has no business
 * holding an SMTP conversation open, and an HTTP call either returns or times
 * out. MAILTRAP_SENDING_TOKEN therefore does belong in the app's environment,
 * unlike the SMTP credentials, which belong only in Supabase.
 *
 * Sending is best-effort by design. A welcome email that fails must never take
 * down the sign-in it was triggered by.
 */

const ENDPOINT = "https://send.api.mailtrap.io/api/send";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Some clients show it, and spam filters read it. */
  text: string;
}

export async function sendMail(mail: Mail): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.MAILTRAP_SENDING_TOKEN;
  const from = process.env.MAIL_FROM ?? "tech+noreply@whrdhub.org";

  if (!token) {
    // Not an error in development, where no token is configured.
    console.warn("[email] MAILTRAP_SENDING_TOKEN is not set — nothing sent");
    return { ok: false, error: "not configured" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Api-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: from, name: "WHRD Hub" },
        to: [{ email: mail.to }],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        category: "transactional",
      }),
      // A sign-in must not hang behind an unreachable mail provider.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] send failed", res.status, detail.slice(0, 300));
      return { ok: false, error: `mailtrap ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw", e instanceof Error ? e.message : e);
    return { ok: false, error: "send failed" };
  }
}
