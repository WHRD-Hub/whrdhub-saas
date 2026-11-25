import { Briefcase, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-hero";
import { EditableImage } from "@/components/site-edit/editable-image";
import { OPPORTUNITIES } from "@/lib/site-content";

export const metadata = {
  title: "Get Involved — WHRD Hub",
  description: "Opportunities to work and volunteer with the Women Human Rights Defenders Hub.",
};

export default function OpportunitiesPage() {
  return (
    <PageShell
      eyebrow="Get involved"
      title="Opportunities"
      accent="purple"
      intro="Calls for partners, expressions of interest, and ways to work with the Hub. New opportunities are posted here as they open."
    >
      <div className="grid sm:grid-cols-2 gap-6">
        {OPPORTUNITIES.map((o, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-40 shrink-0 bg-paper">
              <EditableImage id={`opportunities.${i}.cover`} src={o.cover} alt="" label={`Cover of "${o.title}"`} wrapperClassName="sm:h-full" className="w-full h-40 sm:h-full object-cover" />
            </div>
            <div className="p-5 flex flex-col">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-magenta w-fit rounded-full bg-magenta-050 px-2.5 py-0.5">
                <Briefcase className="w-3.5 h-3.5" /> {o.type}
              </span>
              <h2 className="mt-2 font-bold text-ink leading-snug">{o.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{o.blurb}</p>
              <a href="/contact" className="mt-auto pt-3 inline-flex items-center gap-1 text-sm font-bold text-purple">
                Express interest <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-3xl bg-magenta text-white p-10 text-center">
        <h2 className="text-2xl font-black">Volunteer or intern with the Hub</h2>
        <p className="mt-3 text-white/85 max-w-xl mx-auto">
          Bring your skills to the movement. We welcome volunteers and interns who want to support
          women human rights defenders.
        </p>
        <a href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-magenta-700 px-6 py-3.5 text-sm font-bold hover:bg-white/90">
          Get in touch <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </PageShell>
  );
}
