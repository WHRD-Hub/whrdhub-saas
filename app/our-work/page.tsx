import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PILLARS } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
import { EditableText } from "@/components/site-edit/editable-text";
import { EditableImage } from "@/components/site-edit/editable-image";

export const metadata = pageMeta({
  title: "Our Work",
  description: "The pillars that guide the Hub's work: safety, wellbeing, livelihoods, femtorship, movement, and institution building.",
  path: "/our-work",
});

const IMGS = [
  "https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg",
  "https://whrdhub.org/wp-content/uploads/2025/03/IMG_0764-scaled.jpg",
  "https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg",
  "https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg",
  "https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.27.40-1.jpeg",
  "https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.26.32.jpeg",
];

export default function OurWorkPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="brand-wash border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <EditableText as="p" id="our-work.hero.eyebrow" className="text-xs font-bold uppercase tracking-wider text-magenta">Our causes</EditableText>
          <EditableText as="h1" id="our-work.hero.title" className="mt-3 text-4xl lg:text-5xl font-black text-ink leading-tight max-w-3xl">
            Six pillars that hold the movement together
          </EditableText>
          <EditableText as="p" id="our-work.hero.intro" multiline className="mt-4 text-lg text-muted max-w-2xl">
            Everything the Hub does connects back to these pillars, from keeping defenders safe to
            growing the next generation through femtorship.
          </EditableText>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        {PILLARS.map((p, i) => (
          <div key={p.title} className={`grid lg:grid-cols-2 gap-8 items-center ${i % 2 ? "lg:[direction:rtl]" : ""}`}>
            <div className="rounded-3xl overflow-hidden border border-line shadow-lg shadow-purple/5 [direction:ltr]">
              <EditableImage id={`our-work.pillars.${i}.image`} src={IMGS[i % IMGS.length]} alt={p.title} label={`Photo for the pillar "${p.title}"`} className="w-full h-72 object-cover" />
            </div>
            <div className="[direction:ltr]">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-050 text-purple font-black">{i + 1}</span>
              <EditableText as="h2" id={`our-work.pillars.${i}.title`} className="mt-4 text-2xl font-black text-ink">{p.title}</EditableText>
              <EditableText as="p" id={`our-work.pillars.${i}.body`} multiline className="mt-3 text-muted leading-relaxed">{p.body}</EditableText>
            </div>
          </div>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-purple text-white p-10 text-center">
          <EditableText as="h2" id="our-work.cta.title" className="text-3xl font-black">Be part of the work</EditableText>
          <EditableText as="p" id="our-work.cta.text" multiline className="mt-3 text-white/80">Join your county network and help the movement grow.</EditableText>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-purple-700 px-6 py-3.5 text-sm font-bold hover:bg-white/90">
            <EditableText id="our-work.cta.button">Join the Hub</EditableText> <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
