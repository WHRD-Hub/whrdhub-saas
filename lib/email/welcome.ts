/**
 * The welcome email, for accounts that never had to confirm an address.
 *
 * Signing in with Google produces no email at all — Google has already
 * vouched for the address, so Supabase sends nothing. The result is that a
 * woman joins the Hub and hears nothing back, and has no record in her inbox
 * that the account exists or where to reach us. This is that record.
 *
 * Built as a string rather than a Supabase template because Supabase has no
 * hook for it; the shape deliberately matches the templates in
 * supabase/email-templates/ so the three read as one family.
 */

const BRAND = {
  purple: "#734e9e",
  ink: "#1c1522",
  body: "#575061",
  quiet: "#6b6577",
  faint: "#9891a6",
  line: "#e7e2ee",
  page: "#f7f6fa",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function welcomeSubject(): string {
  return "Welcome to the WHRD Hub";
}

export function welcomeText(name: string | null, site: string): string {
  const hello = name ? `Karibu, ${name}.` : "Karibu.";
  return [
    hello,
    "",
    "Your WHRD Hub account is ready. You signed in with Google, so there was nothing to confirm.",
    "",
    `Your dashboard: ${site}/dashboard`,
    "",
    "A few things worth knowing:",
    "",
    "- Joining a county chapter lets you post to the community and publish stories.",
    "- Femtorship matching runs by itself once you have answered a few questions.",
    `- You can report abuse at any time, with or without an account: ${site}/report`,
    "",
    `If you did not create this account, tell us at ${site}/contact`,
    "",
    "Women Human Rights Defenders Hub. Protect. Heal. Nurture.",
  ].join("\n");
}

export function welcomeHtml(name: string | null, site: string): string {
  const hello = name ? `Karibu, ${escapeHtml(name)}` : "Karibu";
  return `
<div style="display:none;font-size:1px;color:${BRAND.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Your WHRD Hub account is ready.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.page};margin:0;padding:0;width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${BRAND.line};border-radius:16px;padding:38px 30px;font-family:${FONT};">

            <img src="${site}/main-logo.png" alt="Women Human Rights Defenders Hub" width="150" height="49"
                 style="display:block;border:0;outline:none;text-decoration:none;width:150px;height:auto;max-width:150px;margin:0 0 24px 0;" />

            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.ink};">
              ${hello} &mdash; welcome to the Hub
            </h1>

            <p style="margin:0 0 28px 0;font-size:15px;line-height:1.65;color:${BRAND.body};">
              Your account is ready. You signed in with Google, so there was nothing to
              confirm and nothing else to do.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${BRAND.purple}" style="border-radius:12px;">
                  <a href="${site}/dashboard"
                     style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                    Open your dashboard
                  </a>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding:28px 0 24px 0;">
                <div style="height:1px;line-height:1px;font-size:0;background-color:${BRAND.line};">&nbsp;</div>
              </td></tr>
            </table>

            <p style="margin:0 0 14px 0;font-size:13px;line-height:1.65;color:${BRAND.quiet};">
              <strong style="color:${BRAND.ink};font-weight:600;">Join a county chapter.</strong>
              The Hub is a network of chapters. Joining one lets you post to the community
              and publish stories under your chapter&rsquo;s name.
            </p>

            <p style="margin:0 0 14px 0;font-size:13px;line-height:1.65;color:${BRAND.quiet};">
              <strong style="color:${BRAND.ink};font-weight:600;">Femtorship.</strong>
              Answer a few questions and matching runs by itself. Nothing waits on an
              administrator.
            </p>

            <p style="margin:0;font-size:13px;line-height:1.65;color:${BRAND.quiet};">
              <strong style="color:${BRAND.ink};font-weight:600;">Reporting never needs an account.</strong>
              You can report abuse at any time, anonymously, at
              <a href="${site}/report" style="color:${BRAND.purple};text-decoration:none;">${site}/report</a>
            </p>

            <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:${BRAND.faint};">
              If you did not create this account, please
              <a href="${site}/contact" style="color:${BRAND.purple};text-decoration:none;">tell us</a>.
            </p>

          </td>
        </tr>
        <tr>
          <td align="left" style="padding:20px 4px 0 4px;font-family:${FONT};">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.faint};">
              Women Human Rights Defenders Hub &middot; Protect. Heal. Nurture.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/** A name comes from a third party and lands in markup; treat it as hostile. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
