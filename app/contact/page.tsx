import Link from "next/link";
import { Mail, MapPin, ShieldAlert, Youtube } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { links } from "@/lib/site-nav";
import { HUB_CHANNEL_URL } from "@/lib/videos";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Contact Us",
  description: "Get in touch with the Women Human Rights Defenders Hub.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="brand-wash border-b border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-purple">Contact</p>
          <h1 className="mt-3 text-4xl font-black text-ink">We would love to hear from you</h1>
          <p className="mt-3 text-muted max-w-xl mx-auto">
            Whether you are a defender looking to connect, a partner, or a supporter, reach out and
            our team will get back to you.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 grid sm:grid-cols-2 gap-5">
        <a href="mailto:info@whrdhub.org" className="rounded-2xl border border-line bg-surface p-6 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-purple-050 text-purple flex items-center justify-center"><Mail className="w-5 h-5" /></div>
          <h2 className="mt-4 font-bold text-ink">Email us</h2>
          <p className="text-sm text-muted mt-1">info@whrdhub.org</p>
        </a>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="w-11 h-11 rounded-xl bg-cyan-050 text-cyan-700 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
          <h2 className="mt-4 font-bold text-ink">Where we work</h2>
          <p className="text-sm text-muted mt-1">Eight county networks across Kenya, anchored in Nairobi.</p>
        </div>
        <Link href={links.reportAbuse} className="rounded-2xl border border-line bg-magenta-050 p-6 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-magenta text-white flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></div>
          <h2 className="mt-4 font-bold text-ink">Report abuse</h2>
          <p className="text-sm text-muted mt-1">Securely report an incident. Anonymous, encrypted, confidential.</p>
        </Link>
        <a href={HUB_CHANNEL_URL} target="_blank" className="rounded-2xl border border-line bg-surface p-6 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-[#FF0000]/10 text-[#FF0000] flex items-center justify-center"><Youtube className="w-5 h-5" /></div>
          <h2 className="mt-4 font-bold text-ink">Watch our work</h2>
          <p className="text-sm text-muted mt-1">The Hub Kenya on YouTube.</p>
        </a>
      </section>

      <SiteFooter />
    </div>
  );
}
