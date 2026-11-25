import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/page-hero";
import { EditableImage } from "@/components/site-edit/editable-image";
import { COUNTIES } from "@/lib/counties";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "County Networks",
  description: "The eight county networks where the Women Human Rights Defenders Hub works across Kenya.",
  path: "/counties",
});

export default function CountiesIndex() {
  return (
    <PageShell
      eyebrow="Our work"
      title="County networks"
      accent="purple"
      intro="Defenders organise close to home. These are the eight county networks where the Hub works today, each led by a local organisation on the ground."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {COUNTIES.map((c) => (
          <Link
            key={c.slug}
            href={`/counties/${c.slug}`}
            className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative h-40 overflow-hidden">
              <EditableImage id={`counties.${c.slug}.hero`} src={c.hero} alt={c.name} label={`Photo of the ${c.name} network (card and county page)`} wrapperClassName="h-full" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-white">
                <MapPin className="w-4 h-4" />
                <span className="font-black text-lg">{c.name}</span>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700">{c.network}</p>
              <p className="mt-1.5 text-sm text-muted line-clamp-2">{c.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-purple">
                Explore network <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
