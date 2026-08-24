import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { LegalPage, LegalSection } from "@/components/legal-layout";

export const metadata = pageMeta({
  title: "Terms of Use",
  description:
    "The terms that govern your use of the Women Human Rights Defenders Hub website and member platform.",
  path: "/terms-of-use",
});

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-2 marker:text-purple">{children}</ul>
);

export default function TermsOfUsePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      intro="These terms govern your use of whrdhub.org and the WHRD Hub member platform, operated by the Women Human Rights Defenders Hub (“the Hub”, “we”, “us”). By creating an account or using the site, you agree to them."
    >
      <LegalSection id="acceptance" heading="1. Acceptance of these terms">
        <p>
          By accessing this website or creating an account you confirm that you are at least 18 years
          old and that you accept these terms and our{" "}
          <Link href="/privacy-policy" className="text-purple-700 font-semibold hover:underline">Privacy Policy</Link>.
          If you do not agree, please do not use the platform.
        </p>
      </LegalSection>

      <LegalSection id="platform" heading="2. What the platform is">
        <p>
          The Hub provides an online space for women human rights defenders and their organisations
          to connect, publish stories and updates, share resources, find femtorship, and take part in
          county networks. Some areas are open to the public; others require an account.
        </p>
        <p>
          The platform is provided for community, informational, and advocacy purposes. It is not a
          substitute for legal, medical, security, or psychosocial advice from a qualified
          professional.
        </p>
      </LegalSection>

      <LegalSection id="accounts" heading="3. Your account">
        <Ul>
          <li>Give accurate information when you register, and keep it up to date.</li>
          <li>You are responsible for activity that happens under your account. Keep your sign-in credentials secure and tell us promptly if you suspect unauthorised access.</li>
          <li>One person, one account. Do not impersonate another person or organisation.</li>
          <li>You may close your account at any time from your profile settings.</li>
        </Ul>
      </LegalSection>

      <LegalSection id="conduct" heading="4. Community conduct">
        <p>This is a platform for defenders. You agree not to:</p>
        <Ul>
          <li>harass, threaten, intimidate, dox, or incite violence against any person;</li>
          <li>publish hate speech or content that demeans people on the basis of who they are;</li>
          <li>post sexual content involving minors, or non-consensual intimate images;</li>
          <li>share another person&apos;s private information, location, or identifying details without their clear consent — this is especially serious given the risks defenders face;</li>
          <li>publish content you know to be false in a way that could endanger someone;</li>
          <li>post spam, scams, malware, or unsolicited commercial promotion;</li>
          <li>scrape, harvest, or bulk-download member data, or attempt to identify members who post under restricted visibility;</li>
          <li>interfere with the platform&apos;s security, or attempt to access accounts or data you are not authorised to access;</li>
          <li>use the platform for anything unlawful under Kenyan law.</li>
        </Ul>
      </LegalSection>

      <LegalSection id="your-content" heading="5. Content you post">
        <p>
          You keep ownership of everything you post. By posting, you grant the Hub a non-exclusive,
          royalty-free licence to host, store, display, and distribute that content on the platform
          and, where you have published it publicly, to feature it in the Hub&apos;s communications
          and newsletters with attribution to you. This licence ends when you delete the content,
          except for copies already distributed or retained in backups.
        </p>
        <p>
          You confirm that you have the right to post what you post, including any images of other
          people, and that you have their consent where consent is needed.
        </p>
      </LegalSection>

      <LegalSection id="moderation" heading="6. Moderation">
        <p>
          Contributions may be reviewed before or after publication. We may edit for clarity, decline
          to publish, remove content, or suspend or terminate an account that breaches these terms or
          puts members at risk. Where it is safe and practical to do so, we will tell you why, and you
          may appeal by writing to{" "}
          <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>.
        </p>
      </LegalSection>

      <LegalSection id="our-content" heading="7. The Hub's content and marks">
        <p>
          The Hub&apos;s name, logo, design, text, and compiled materials are owned by the Hub or its
          licensors. You may read, quote with attribution, and share links freely. You may not
          reproduce our materials commercially or use our name or logo to suggest endorsement without
          written permission.
        </p>
      </LegalSection>

      <LegalSection id="third-party" heading="8. Third-party links and services">
        <p>
          The platform links to external sites and services, including the reporting platform, our
          social media channels, and partner organisations. We do not control those services and are
          not responsible for their content or their privacy practices. Their own terms apply.
        </p>
      </LegalSection>

      <LegalSection id="safety" heading="9. Safety and reporting abuse">
        <p>
          If you are in immediate danger, contact local emergency services first. To report an
          incident to the Hub&apos;s reporting platform, or to report content or behaviour on this
          platform, use the reporting tools on the site or email{" "}
          <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>.
        </p>
      </LegalSection>

      <LegalSection id="availability" heading="10. Availability">
        <p>
          We work to keep the platform running, but we provide it on an “as is” and “as available”
          basis. We may change, suspend, or discontinue features, and we may carry out maintenance
          without notice.
        </p>
      </LegalSection>

      <LegalSection id="liability" heading="11. Liability">
        <p>
          To the fullest extent permitted by Kenyan law, the Hub is not liable for indirect or
          consequential loss arising from your use of the platform, for content posted by other
          users, or for the actions of third parties. Nothing in these terms excludes liability that
          cannot lawfully be excluded.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="12. Changes to these terms">
        <p>
          We may update these terms. The revised version will be posted here with a new date, and
          significant changes will be notified to account holders. Continuing to use the platform
          after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection id="law" heading="13. Governing law">
        <p>
          These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction
          over any dispute arising from them.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="14. Contact">
        <p>
          Women Human Rights Defenders Hub, P.O. Box 7403 – 00100, Nairobi, Kenya —{" "}
          <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">info@whrdhub.org</a>,
          +254 797 538 183.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
