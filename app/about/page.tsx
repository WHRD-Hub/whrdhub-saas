import Link from "next/link";
import { ArrowRight, Target, Compass, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Avatar } from "@/components/ui/field";
import { SITE, PILLARS, LAWLOR_QUOTE } from "@/lib/data";
import { LEADERSHIP, BOARD, STAFF, type Person } from "@/lib/team";
import { pageMeta } from "@/lib/seo";
import { PARTNERS } from "@/lib/site-content";
import { EditableText } from "@/components/site-edit/editable-text";
import { EditableImage } from "@/components/site-edit/editable-image";

export const metadata = pageMeta({
  title: "About Us",
  description: "The Women Human Rights Defenders Hub connects and protects women defenders across Kenya. Meet our board, staff, and partners.",
  path: "/about",
});

const HERO = "https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg";

/** A stable key for a person's editable details: their name, not their place in the list. */
const personKey = (p: Person) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function PersonCard({ p, accent = false }: { p: Person; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-paper overflow-hidden">
        <EditableImage id={`about.people.${personKey(p)}.photo`} src={p.photo} alt={p.name} label={`Photo of ${p.name}`} wrapperClassName="h-full" className="w-full h-full object-cover object-top"
          fallback={<div className="w-full h-full flex items-center justify-center"><Avatar name={p.name} size={80} /></div>} />
      </div>
      <div className="p-5 flex-1">
        <EditableText as="h3" id={`about.people.${personKey(p)}.name`} className="font-bold text-ink text-lg">{p.name}</EditableText>
        <EditableText as="p" id={`about.people.${personKey(p)}.role`} className={`text-sm font-semibold ${accent ? "text-magenta-700" : "text-purple-700"}`}>{p.role}</EditableText>
        {p.blurb && <EditableText as="p" id={`about.people.${personKey(p)}.blurb`} multiline className="mt-2.5 text-sm text-muted leading-relaxed">{p.blurb}</EditableText>}
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="brand-wash border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <EditableText as="p" id="about.about-the-hub" className="text-xs font-bold uppercase tracking-wider text-purple">About the Hub</EditableText>
            <EditableText as="h1" id="about.protecting-the-women-who-protect" className="mt-3 text-4xl lg:text-5xl font-black text-ink leading-tight">Protecting the women who protect us all</EditableText>
            <EditableText as="p" id="about.hero.intro" multiline className="mt-4 text-lg text-muted leading-relaxed">
              The Women Human Rights Defenders Hub, known simply as the Hub, brings together defenders
              and their organisations across Kenya. We invest in their safety, wellbeing, livelihoods,
              and femtorship so the movement grows stronger together.
            </EditableText>
          </div>
          <div className="rounded-3xl overflow-hidden border border-line shadow-xl shadow-purple/10">
            <EditableImage id="about.hero.image" src={HERO} alt="The Hub" label="Main photo at the top of the About page" className="w-full h-80 object-cover" />
          </div>
        </div>
      </section>

      {/* Vision + Mission */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-purple text-white p-8">
          <Compass className="w-8 h-8 text-white/80" />
          <EditableText as="p" id="about.our-vision" className="mt-4 text-xs font-bold uppercase tracking-wider text-white/85">Our vision</EditableText>
          <EditableText as="p" id="about.vision.text" multiline className="mt-2 text-2xl font-bold leading-snug">{SITE.vision}</EditableText>
        </div>
        <div className="rounded-3xl bg-magenta text-white p-8">
          <Target className="w-8 h-8 text-white/80" />
          <EditableText as="p" id="about.our-mission" className="mt-4 text-xs font-bold uppercase tracking-wider text-white/85">Our mission</EditableText>
          <EditableText as="p" id="about.mission.text" multiline className="mt-2 text-2xl font-bold leading-snug">{SITE.mission}</EditableText>
        </div>
      </section>

      {/* Our impact */}
      <section id="impact" className="bg-gradient-to-br from-purple-050 via-[#f4f0fb] to-cyan-050 border-y border-line scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-2xl">
            <EditableText as="p" id="about.our-impact" className="text-xs font-bold uppercase tracking-wider text-magenta-700">Our impact</EditableText>
            <EditableText as="h2" id="about.the-difference-we-are-making" className="mt-2 text-3xl font-black text-ink">The difference we are making together</EditableText>
            <EditableText as="p" id="about.across-kenya-and-beyond-the" multiline className="mt-3 text-muted">Across Kenya and beyond, the Hub protects, heals, and nurtures the women who defend everyone else&apos;s rights.</EditableText>
          </div>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { k: "9", v: "County networks", d: "Grassroots defender networks connected across the country" },
              { k: "6", v: "Pillars of protection", d: "Safety, wellbeing, livelihoods, femtorship, movement, institutions" },
              { k: "3", v: "Countries convened", d: "Protection networks strengthened across Kenya, Uganda & Tanzania" },
              { k: "1", v: "Shared movement", d: "One platform uniting defenders, CBOs, and the national office" },
            ].map((s, i) => (
              <div key={s.v} className="rounded-2xl border border-line bg-surface p-5">
                <EditableText as="p" id={`about.impact.${i}.number`} className="text-4xl font-black text-purple">{s.k}</EditableText>
                <EditableText as="p" id={`about.impact.${i}.label`} className="mt-1 font-bold text-ink text-sm">{s.v}</EditableText>
                <EditableText as="p" id={`about.impact.${i}.text`} multiline className="mt-1 text-xs text-muted leading-relaxed">{s.d}</EditableText>
              </div>
            ))}
          </div>
          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            {[
              { t: "Safety & security", b: "Multi-day safety and security trainings equip defenders to assess risk and respond to threats online and offline." },
              { t: "Femtorship", b: "Defenders are matched with femtors, growing the next generation of women leaders and activists." },
              { t: "Solidarity in crisis", b: "When defenders face threats, the network responds together with protection, wellbeing, and legal support." },
            ].map((h, i) => (
              <div key={h.t} className="rounded-2xl bg-surface/70 border border-line p-5">
                <EditableText as="h3" id={`about.highlights.${i}.title`} className="font-bold text-ink">{h.t}</EditableText>
                <EditableText as="p" id={`about.highlights.${i}.text`} multiline className="mt-1.5 text-sm text-muted leading-relaxed">{h.b}</EditableText>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach / pillars */}
      <section id="approach" className="bg-paper border-y border-line scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-2xl">
            <EditableText as="p" id="about.our-approach" className="text-xs font-bold uppercase tracking-wider text-magenta-700">Our approach</EditableText>
            <EditableText as="h2" id="about.how-we-work" className="mt-2 text-3xl font-black text-ink">How we work</EditableText>
            <EditableText as="p" id="about.our-work-rests-on-six" multiline className="mt-3 text-muted">Our work rests on six pillars that wrap around the whole defender.</EditableText>
          </div>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PILLARS.map((p, i) => (
              <div key={p.title} className="rounded-2xl border border-line bg-surface p-6">
                <div className="w-10 h-10 rounded-xl bg-purple-050 text-purple flex items-center justify-center font-black">{i + 1}</div>
                <EditableText as="h3" id={`about.pillars.${i}.title`} className="mt-3 font-bold text-ink">{p.title}</EditableText>
                <EditableText as="p" id={`about.pillars.${i}.body`} multiline className="mt-1.5 text-sm text-muted leading-relaxed">{p.body}</EditableText>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership + Board */}
      <section id="board" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
        <div className="max-w-2xl">
          <EditableText as="p" id="about.leadership" className="text-xs font-bold uppercase tracking-wider text-purple">Leadership</EditableText>
          <EditableText as="h2" id="about.the-people-behind-the-hub" className="mt-2 text-3xl font-black text-ink">The people behind the Hub</EditableText>
          <EditableText as="p" id="about.a-board-and-team-who" multiline className="mt-3 text-muted">A board and team who bring decades of experience in human rights, media, law, and grassroots organising.</EditableText>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEADERSHIP.map((p) => <PersonCard key={p.name} p={p} accent />)}
          {BOARD.map((p) => <PersonCard key={p.name} p={p} />)}
        </div>
      </section>

      {/* Staff */}
      <section id="staff" className="bg-paper border-y border-line scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-2xl">
            <EditableText as="p" id="about.our-team" className="text-xs font-bold uppercase tracking-wider text-magenta-700">Our team</EditableText>
            <EditableText as="h2" id="about.staff" className="mt-2 text-3xl font-black text-ink">Staff</EditableText>
            <EditableText as="p" id="about.the-team-keeping-the-hub" className="mt-3 text-muted">The team keeping the Hub running, pillar by pillar.</EditableText>
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STAFF.map((p) => (
              <div key={p.name} className="rounded-2xl border border-line bg-surface overflow-hidden text-center">
                <div className="aspect-square bg-paper overflow-hidden">
                  <EditableImage id={`about.people.${personKey(p)}.photo`} src={p.photo} alt={p.name} label={`Photo of ${p.name}`} wrapperClassName="h-full" className="w-full h-full object-cover object-top"
                    fallback={<div className="w-full h-full flex items-center justify-center"><Avatar name={p.name} size={56} /></div>} />
                </div>
                <div className="p-4">
                  <EditableText as="h3" id={`about.people.${personKey(p)}.name`} className="font-bold text-ink text-sm">{p.name}</EditableText>
                  <EditableText as="p" id={`about.people.${personKey(p)}.role`} className="text-xs text-purple-700 font-semibold">{p.role}</EditableText>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
        <div className="max-w-2xl">
          <EditableText as="p" id="about.our-partners" className="text-xs font-bold uppercase tracking-wider text-purple">Our partners</EditableText>
          <EditableText as="h2" id="about.who-we-work-with" className="mt-2 text-3xl font-black text-ink">Who we work with</EditableText>
          <EditableText as="p" id="about.the-funders-networks-and-allies" multiline className="mt-3 text-muted">The funders, networks, and allies who stand with women human rights defenders across Kenya and the region.</EditableText>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {PARTNERS.map((p, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5 flex items-center justify-center h-28 hover:shadow-md transition-shadow">
              <EditableImage id={`about.partners.${i}.logo`} src={p.logo} alt={p.name} label={`Partner logo: ${p.name}`} className="max-h-14 max-w-full object-contain" />
            </div>
          ))}
        </div>
      </section>

      {/* Quote + CTA */}
      <section className="bg-purple text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Users className="w-8 h-8 text-white/80 mx-auto" />
          <p className="mt-4 text-2xl font-medium leading-relaxed">&ldquo;<EditableText id="about.quote.text" multiline>{LAWLOR_QUOTE.text}</EditableText>&rdquo;</p>
          <EditableText as="p" id="about.quote.who" className="mt-5 font-bold">{LAWLOR_QUOTE.who}</EditableText>
          <EditableText as="p" id="about.quote.role" className="text-sm text-white/85">{LAWLOR_QUOTE.role}</EditableText>
          <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white text-purple-700 px-6 py-3.5 text-sm font-bold hover:bg-white/90">
            <EditableText id="about.cta.button">Join the movement</EditableText> <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
