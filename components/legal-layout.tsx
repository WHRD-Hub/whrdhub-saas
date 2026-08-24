import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const LEGAL_LAST_UPDATED = "24 August 2026";

/** Shared shell + typography for the public legal pages. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="brand-wash border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-wider text-purple">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black text-ink leading-tight">{title}</h1>
          <p className="mt-4 text-muted leading-relaxed">{intro}</p>
          <p className="mt-4 text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">{children}</section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          Questions about this page? Email{" "}
          <a href="mailto:info@whrdhub.org" className="text-purple-700 font-semibold hover:underline">
            info@whrdhub.org
          </a>{" "}
          or visit our <Link href="/contact" className="text-purple-700 font-semibold hover:underline">contact page</Link>.
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ id, heading, children }: { id: string; heading: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mt-10 first:mt-0">
      <h2 className="text-xl font-black text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-muted leading-relaxed">{children}</div>
    </section>
  );
}
