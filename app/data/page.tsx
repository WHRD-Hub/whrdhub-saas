import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { LegalPage, LegalSection } from "@/components/legal-layout";

export const metadata = pageMeta({
  title: "Data Use and Deletion",
  description:
    "How the Women Human Rights Defenders Hub handles personal data as a registered data controller under Kenya's Data Protection Act, and how to delete your account and data.",
  path: "/data",
});

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc space-y-2 pl-5 marker:text-purple">{children}</ul>
);

const Ol = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal space-y-3 pl-5 marker:font-bold marker:text-purple">{children}</ol>
);

/**
 * The public data-use page.
 *
 * Two jobs. It is the plain-language account of what the Hub does with
 * personal data as a data controller under Kenya's Data Protection Act, and it
 * is the deletion-instructions page that Meta and other platforms require at a
 * stable public URL. The #deletion anchor is what those verifications point at,
 * so that section has to stand on its own and be reachable without an account.
 */
export default function DataPage() {
  return (
    <LegalPage
      eyebrow="Data protection"
      title="Data use and deletion"
      intro="The Women Human Rights Defenders Hub is the data controller for personal data processed through whrdhub.org and the WHRD Hub platform. This page explains what we hold, the basis on which we hold it, the rights you have under Kenyan law, and exactly how to delete your account and your data."
    >
      <div className="mb-10 rounded-2xl border border-purple/20 bg-purple-050/60 p-5">
        <p className="text-sm font-bold text-ink">Looking for how to delete your data?</p>
        <p className="mt-1 text-sm text-muted">
          Go straight to{" "}
          <a href="#deletion" className="font-semibold text-purple-700 hover:underline">
            account and data deletion
          </a>
          . You can do it yourself in the app, or ask us to do it for you.
        </p>
      </div>

      <LegalSection id="controller" heading="1. Who is responsible for your data">
        <p>
          The Women Human Rights Defenders Hub (&ldquo;the Hub&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) is the <strong className="text-ink">data controller</strong> for
          personal data processed through this website, the WHRD Hub member platform, and the
          reporting service. That means we determine why personal data is processed and how,
          and we carry the legal responsibility for it.
        </p>
        <p>
          We process personal data in accordance with the{" "}
          <strong className="text-ink">Data Protection Act, 2019</strong> of Kenya and the Data
          Protection (General) Regulations, 2021, and we are subject to the oversight of the{" "}
          <strong className="text-ink">Office of the Data Protection Commissioner (ODPC)</strong>.
          Registration as a data controller with the ODPC is a legal requirement for
          organisations of our kind, and we maintain that registration.
        </p>
        <Ul>
          <li>Data controller: The Women Human Rights Defenders Hub</li>
          <li>Postal address: P.O. Box 7403 &ndash; 00100, Nairobi, Kenya</li>
          <li>
            Data protection contact:{" "}
            <a href="mailto:data@whrdhub.org" className="font-semibold text-purple-700 hover:underline">
              data@whrdhub.org
            </a>
          </li>
        </Ul>
        <p className="rounded-xl border border-line bg-paper p-4 text-sm">
          If you operate this site: replace the address and contact above with your registered
          details, and add your ODPC registration number here once issued. Do not publish a
          registration number you have not been granted.
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" heading="2. What we collect, and why">
        <p>
          We collect as little as the service can work with. What we hold depends entirely on
          how you use the platform.
        </p>
        <Ul>
          <li>
            <strong className="text-ink">If you only read the site:</strong> nothing that
            identifies you. Support you give to a post while signed out is stored in your own
            browser, not on our servers.
          </li>
          <li>
            <strong className="text-ink">If you hold an account:</strong> your name or chosen
            username, email address, and anything you choose to add &mdash; a photograph, a
            title, a county network, an organisation.
          </li>
          <li>
            <strong className="text-ink">If you post or publish:</strong> the content you write
            and the media you attach.
          </li>
          <li>
            <strong className="text-ink">If you file a report:</strong> what you tell us about
            the incident, and only that. You may report without giving your name at all. We do
            not record the IP address of a report.
          </li>
          <li>
            <strong className="text-ink">Technical data</strong> needed to keep the service up
            and secure, such as error logs. These are kept briefly and are not used to profile
            anyone.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="sensitive" heading="3. Sensitive personal data">
        <p>
          A report about violence or abuse is <strong className="text-ink">sensitive personal
          data</strong> under the Data Protection Act. We treat it accordingly:
        </p>
        <Ul>
          <li>It is encrypted in transit and at rest.</li>
          <li>
            It is readable only by the small response team that handles cases, and by you.
            Other members of the platform can never see it.
          </li>
          <li>
            Support services see what they need to help and no more. Your identity is not
            shared with a service without a referral you are part of.
          </li>
          <li>
            We do not sell personal data, we do not use it for advertising, and we do not
            share it with advertisers or data brokers. Ever.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="basis" heading="4. Our lawful basis">
        <p>Under section 30 of the Act, we rely on:</p>
        <Ul>
          <li>
            <strong className="text-ink">Your consent</strong> &mdash; for your account, your
            profile, and anything you publish. You can withdraw it at any time by deleting
            your account.
          </li>
          <li>
            <strong className="text-ink">Vital interests</strong> &mdash; where acting on a
            report is necessary to protect someone&rsquo;s life or safety.
          </li>
          <li>
            <strong className="text-ink">Legitimate interests</strong> &mdash; keeping the
            platform secure and preventing abuse of it, balanced against your rights.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="rights" heading="5. Your rights">
        <p>The Data Protection Act gives you the right to:</p>
        <Ul>
          <li>be told how your personal data is being used;</li>
          <li>access the personal data we hold about you;</li>
          <li>object to the processing of all or part of it;</li>
          <li>have inaccurate or misleading data corrected;</li>
          <li>
            have your personal data deleted &mdash; see{" "}
            <a href="#deletion" className="font-semibold text-purple-700 hover:underline">
              account and data deletion
            </a>{" "}
            below.
          </li>
        </Ul>
        <p>
          To exercise any of these, email{" "}
          <a href="mailto:data@whrdhub.org" className="font-semibold text-purple-700 hover:underline">
            data@whrdhub.org
          </a>
          . We respond within <strong className="text-ink">seven days</strong> and complete the
          request within <strong className="text-ink">thirty days</strong>. There is no charge.
        </p>
      </LegalSection>

      {/* ── The anchor Meta and other platform verifications point at. ─────── */}
      <LegalSection id="deletion" heading="6. Account and data deletion">
        <p>
          You can delete your account and the personal data attached to it at any time. You do
          not need to give a reason and you do not need our permission.
        </p>

        <h3 className="pt-2 text-base font-black text-ink">Deleting it yourself, in the app</h3>
        <Ol>
          <li>
            Sign in at{" "}
            <Link href="/login" className="font-semibold text-purple-700 hover:underline">
              whrdhub.org/login
            </Link>
            .
          </li>
          <li>
            Open <strong className="text-ink">Account</strong> from the menu on the left, or go
            directly to{" "}
            <Link href="/dashboard/account" className="font-semibold text-purple-700 hover:underline">
              whrdhub.org/dashboard/account
            </Link>
            .
          </li>
          <li>
            Scroll to <strong className="text-ink">Delete your account</strong> and choose{" "}
            <strong className="text-ink">Delete my account</strong>.
          </li>
          <li>
            Type <strong className="font-mono text-ink">DELETE</strong> to confirm. This step
            exists so it cannot happen by accident.
          </li>
          <li>Your account is removed and you are signed out immediately.</li>
        </Ol>

        <h3 className="pt-2 text-base font-black text-ink">Asking us to delete it for you</h3>
        <p>
          If you cannot sign in &mdash; you have lost the password, or you reported anonymously
          and no longer have the details &mdash; email{" "}
          <a href="mailto:data@whrdhub.org" className="font-semibold text-purple-700 hover:underline">
            data@whrdhub.org
          </a>{" "}
          with the subject line <strong className="text-ink">Delete my data</strong>. Tell us the
          email address or username on the account. We may ask one question to confirm the
          account is yours, so that nobody can delete someone else&rsquo;s.
        </p>
        <p>
          We acknowledge within <strong className="text-ink">seven days</strong> and complete
          deletion within <strong className="text-ink">thirty days</strong>.
        </p>

        <h3 className="pt-2 text-base font-black text-ink">What deletion removes</h3>
        <Ul>
          <li>Your profile: name, username, email address, photograph, biography, title.</li>
          <li>Your posts, your published stories and your comments.</li>
          <li>Your femtorship answers and any femtorship connections.</li>
          <li>Your membership of any county network or organisation.</li>
          <li>Reports you filed through your account.</li>
        </Ul>

        <h3 className="pt-2 text-base font-black text-ink">
          What may remain, and for how long
        </h3>
        <Ul>
          <li>
            <strong className="text-ink">Content other people wrote</strong> stays. If someone
            replied to you, their words are theirs.
          </li>
          <li>
            <strong className="text-ink">Anonymous, aggregate statistics</strong> &mdash; such
            as the number of reports from a county in a year &mdash; remain. These cannot be
            traced back to any individual and are not personal data.
          </li>
          <li>
            <strong className="text-ink">Records we are required by law to keep</strong> are
            retained only for as long as that legal obligation lasts, and for nothing else.
            Where a case has been referred to a support service or an authority, that
            organisation holds its own records under its own policy.
          </li>
          <li>
            <strong className="text-ink">Backups</strong> roll forward on a fixed cycle and are
            fully overwritten within <strong className="text-ink">thirty days</strong>.
          </li>
        </Ul>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">If you are in danger</p>
          <p className="mt-1 leading-relaxed">
            Deleting your account does not close a case that a support service is already
            working on with you, and it does not cancel help that is on its way. If you want a
            report withdrawn as well as your account deleted, say so in your message and we
            will do both. In an emergency call{" "}
            <a href="tel:1195" className="font-bold underline">
              1195
            </a>{" "}
            (GBV helpline) or{" "}
            <a href="tel:999" className="font-bold underline">
              999
            </a>
            .
          </p>
        </div>
      </LegalSection>

      <LegalSection id="retention" heading="7. How long we keep things">
        <Ul>
          <li>
            <strong className="text-ink">Account data:</strong> for as long as the account is
            open, and then removed on deletion as set out above.
          </li>
          <li>
            <strong className="text-ink">Reports:</strong> for as long as the case is open, and
            afterwards only as long as any legal obligation requires.
          </li>
          <li>
            <strong className="text-ink">Technical logs:</strong> a short rolling window,
            typically thirty days.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="security" heading="8. How we protect it">
        <Ul>
          <li>Encrypted in transit (TLS) and at rest.</li>
          <li>
            Access limited to the people whose role requires it, enforced in the database
            itself rather than only in the interface.
          </li>
          <li>Every action on a report is written to an audit trail.</li>
          <li>
            If a breach ever put your rights at risk, we notify the ODPC within{" "}
            <strong className="text-ink">seventy-two hours</strong> of becoming aware of it, and
            we tell you as soon as reasonably practicable.
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="sharing" heading="9. Who else sees your data">
        <p>
          We use a small number of processors to run the service, each bound by contract to
          process data only on our instructions: our hosting and database provider, our email
          provider, and our SMS provider for the USSD reporting service. Some process data
          outside Kenya; where they do, transfers are made under appropriate safeguards as
          required by the Act.
        </p>
        <p>
          We share a report with a support service only through a referral, and only what that
          service needs in order to help. We do not sell personal data and we never share it
          for advertising.
        </p>
      </LegalSection>

      <LegalSection id="complaints" heading="10. Complaints">
        <p>
          If you are unhappy with how we have handled your personal data, tell us first at{" "}
          <a href="mailto:data@whrdhub.org" className="font-semibold text-purple-700 hover:underline">
            data@whrdhub.org
          </a>{" "}
          and we will try to put it right.
        </p>
        <p>
          You also have the right to complain directly to the Office of the Data Protection
          Commissioner, and you do not have to come to us first:
        </p>
        <Ul>
          <li>
            Email:{" "}
            <a
              href="mailto:complaint@odpc.go.ke"
              className="font-semibold text-purple-700 hover:underline"
            >
              complaint@odpc.go.ke
            </a>
          </li>
          <li>Telephone: 020 780 1800</li>
          <li>
            Address: Britam Towers, 12th Floor, Hospital Road, Upper Hill, Nairobi. P.O. Box
            30920 &ndash; 00100, Nairobi
          </li>
          <li>
            Online:{" "}
            <a
              href="https://www.odpc.go.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-purple-700 hover:underline"
            >
              odpc.go.ke
            </a>
          </li>
        </Ul>
      </LegalSection>

      <LegalSection id="changes" heading="11. Changes to this page">
        <p>
          If we change how we handle personal data in a way that affects you, we will update
          this page and, where the change is significant, tell account holders directly. See
          also our{" "}
          <Link href="/privacy-policy" className="font-semibold text-purple-700 hover:underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/terms-of-use" className="font-semibold text-purple-700 hover:underline">
            terms of use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
