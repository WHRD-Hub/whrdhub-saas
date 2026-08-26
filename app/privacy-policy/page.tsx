import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { LegalPage, LegalSection } from "@/components/legal-layout";

export const metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "How the Women Human Rights Defenders Hub collects, uses, shares, and protects your personal data.",
  path: "/privacy-policy",
});

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-2 marker:text-purple">{children}</ul>
);

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="The Women Human Rights Defenders Hub (“the Hub”, “we”, “us”) runs whrdhub.org and the WHRD Hub member platform. This policy explains what personal data we collect, why we collect it, who we share it with, and the choices you have. Because our users are human rights defenders, we treat privacy and safety as one and the same thing."
    >
      <LegalSection id="who-we-are" heading="1. Who we are">
        <p>
          The Women Human Rights Defenders Hub (The Hub) is a Kenyan network supporting women human
          rights defenders. We are the data controller for personal data processed through this
          website and platform.
        </p>
        <Ul>
          <li>Postal address: P.O. Box 7403 – 00100, Nairobi, Kenya</li>
          <li>
            Email: <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>
          </li>
          <li>Phone: +254 797 538 183</li>
        </Ul>
      </LegalSection>

      <LegalSection id="data-we-collect" heading="2. Information we collect">
        <p>We collect only what we need to run the platform.</p>
        <Ul>
          <li>
            <strong className="text-ink">Account information.</strong> Your name, email address, and
            profile photo, provided by you or by your sign-in provider when you create an account.
          </li>
          <li>
            <strong className="text-ink">Profile information.</strong> Details you choose to add,
            such as your county network, organisation, role, biography, areas of work, and contact
            preferences. You decide how much of this to share.
          </li>
          <li>
            <strong className="text-ink">Content you submit.</strong> Posts, blogs, comments,
            reactions, mentorship requests, newsletter sign-ups, resources, and images you upload.
          </li>
          <li>
            <strong className="text-ink">Technical information.</strong> Log data such as IP address,
            browser type, device type, pages visited, and timestamps, used for security and to keep
            the service working.
          </li>
          <li>
            <strong className="text-ink">Communications.</strong> Messages you send us by email or
            through forms on the site.
          </li>
        </Ul>
        <p>
          We do not ask for sensitive personal data as a condition of using the platform. If you
          choose to publish sensitive information about yourself in a post or profile, remember that
          it may be visible to other members or to the public depending on where you post it.
        </p>
      </LegalSection>

      <LegalSection id="google-sign-in" heading="3. Signing in with Google">
        <p>
          You may create an account or sign in using Google. When you do, Google asks for your
          permission and then shares a limited set of information with us: your name, your email
          address, your Google profile picture, and your Google account identifier.
        </p>
        <Ul>
          <li>We use this information only to create and secure your account, to identify you inside the platform, and to contact you about your account.</li>
          <li>We do not receive or store your Google password.</li>
          <li>We do not access your Gmail, Google Drive, Contacts, Calendar, or any other Google service data.</li>
          <li>We do not sell information obtained through Google sign-in, and we do not use it for advertising or to build advertising profiles.</li>
          <li>We do not transfer this information to third parties except to the service providers listed in section 5, who process it on our behalf, or where the law requires it.</li>
        </Ul>
        <p>
          You can review or revoke the Hub&apos;s access at any time from your Google Account
          permissions page at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-purple-700 font-semibold hover:underline">
            myaccount.google.com/permissions
          </a>
          . Our use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-purple-700 font-semibold hover:underline">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection id="why" heading="4. Why we use your information">
        <Ul>
          <li>To create, secure, and administer your account.</li>
          <li>To display your profile and content to the audience you have chosen.</li>
          <li>To operate community features such as the feed, blogs, county networks, and femtorship matching.</li>
          <li>To send you service messages, and newsletters where you have asked for them.</li>
          <li>To keep the platform safe: preventing abuse, spam, impersonation, and unauthorised access.</li>
          <li>To understand, in aggregate, how the platform is used so we can improve it.</li>
          <li>To meet legal obligations.</li>
        </Ul>
        <p>
          We rely on your consent, on the performance of our agreement with you, on our legitimate
          interest in running a safe platform, and on legal obligations, as the case may be.
        </p>
      </LegalSection>

      <LegalSection id="sharing" heading="5. Who we share information with">
        <p>We do not sell your personal data. We share it only in these situations:</p>
        <Ul>
          <li>
            <strong className="text-ink">Other members and the public.</strong> Information you
            publish — your public profile, posts, blogs, and comments — is visible to the audience
            for that area of the platform.
          </li>
          <li>
            <strong className="text-ink">Service providers.</strong> Companies that host and run the
            platform on our behalf under contract, including our hosting and database providers
            (Supabase and Vercel) and our email delivery provider. They may process your data only on
            our instructions.
          </li>
          <li>
            <strong className="text-ink">Legal requirements.</strong> Where we are required by
            Kenyan law or a valid court order. Where we can lawfully do so, and where it is safe for
            the person concerned, we will tell the affected user before disclosing.
          </li>
          <li>
            <strong className="text-ink">Protection of people.</strong> Where disclosure is
            necessary to prevent serious harm to a person.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="transfers" heading="6. International transfers">
        <p>
          Our providers may store data on servers outside Kenya. Where personal data is transferred
          outside Kenya, we take steps to ensure it remains protected to a standard comparable to
          that required by the Data Protection Act, 2019, including contractual safeguards with our
          providers.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="7. How long we keep it">
        <p>
          We keep your account data for as long as your account is active. If you delete your
          account, we delete or anonymise your personal data within 30 days, except where we must
          keep certain records to comply with the law or to resolve a dispute. Content you published
          publicly may remain visible if it has been quoted, shared, or archived elsewhere.
        </p>
      </LegalSection>

      <LegalSection id="security" heading="8. Security">
        <p>
          Access to the platform is protected by authentication, encryption in transit (HTTPS),
          role-based access controls, and database-level row security. Staff access to member data is
          limited to those who need it. No system is perfectly secure; if a breach affects your
          rights, we will notify you and the Office of the Data Protection Commissioner as required
          by law.
        </p>
      </LegalSection>

      <LegalSection id="rights" heading="9. Your rights">
        <p>Under the Data Protection Act, 2019 you have the right to:</p>
        <Ul>
          <li>be informed about how your data is used;</li>
          <li>access the personal data we hold about you;</li>
          <li>correct data that is inaccurate or incomplete;</li>
          <li>
            ask us to delete your data &mdash; step-by-step instructions are on our{" "}
            <Link href="/data#deletion" className="text-purple-700 font-semibold hover:underline">
              data use and deletion page
            </Link>
            ;
          </li>
          <li>object to or restrict certain processing;</li>
          <li>receive a copy of your data in a portable format;</li>
          <li>withdraw consent at any time, without affecting processing already carried out.</li>
        </Ul>
        <p>
          You can exercise most of these directly in your profile settings, or write to{" "}
          <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>.
          We respond within 30 days. You may also lodge a complaint with the Office of the Data
          Protection Commissioner of Kenya.
        </p>
      </LegalSection>

      <LegalSection id="cookies" heading="10. Cookies">
        <p>
          We use cookies and similar local storage that are strictly necessary to keep you signed in,
          remember your accessibility settings, and secure the service. We do not use advertising
          cookies. You can clear or block cookies in your browser, but parts of the platform will not
          work if you do.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="11. Children">
        <p>
          The platform is intended for adults. We do not knowingly create accounts for anyone under
          18. If you believe a child has provided us with personal data, contact us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="12. Changes to this policy">
        <p>
          We may update this policy from time to time. We will post the new version on this page and
          update the date above. If the changes are significant, we will notify account holders by
          email or an in-platform notice.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="13. Contact us">
        <p>
          Write to <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>,
          call +254 797 538 183, or post to P.O. Box 7403 – 00100, Nairobi, Kenya. See also our{" "}
          <Link href="/terms-of-use" className="text-purple-700 font-semibold hover:underline">Terms of Use</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
