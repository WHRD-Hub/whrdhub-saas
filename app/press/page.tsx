import { FileText } from "lucide-react";
import { PageShell } from "@/components/page-hero";
import { EditableImage } from "@/components/site-edit/editable-image";
import { PRESS } from "@/lib/site-content";

export const metadata = {
  title: "Press Releases — WHRD Hub",
  description: "Statements and press releases from the Women Human Rights Defenders Hub.",
};

export default function PressPage() {
  return (
    <PageShell
      eyebrow="Our work"
      title="Press releases"
      accent="cyan"
      intro="Where we stand on the issues that matter to women human rights defenders, in our own words."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {PRESS.map((p, i) => (
          <a
            key={i}
            href={p.cover}
            target="_blank"
            className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow flex"
          >
            <div className="w-28 shrink-0 bg-paper">
              <EditableImage id={`press.${i}.cover`} src={p.cover} alt="" label={`Cover of "${p.title}"`} wrapperClassName="h-full" className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex flex-col">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700">
                <FileText className="w-3.5 h-3.5" /> {p.date}
              </span>
              <h2 className="mt-1.5 font-bold text-ink leading-snug group-hover:text-purple transition-colors">{p.title}</h2>
              <span className="mt-auto pt-3 text-xs font-semibold text-purple">Read statement →</span>
            </div>
          </a>
        ))}
      </div>
    </PageShell>
  );
}
