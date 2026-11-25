import { PageShell } from "@/components/page-hero";
import { EditableText } from "@/components/site-edit/editable-text";
import { EditableImage } from "@/components/site-edit/editable-image";
import { GALLERY } from "@/lib/site-content";
import { ACTIVE_COUNTIES } from "@/lib/data";

export const metadata = {
  title: "Activity Images — WHRD Hub",
  description: "Moments from the movement: trainings, convenings, and community action across our county networks.",
};

export default function ActivityImagesPage() {
  return (
    <PageShell
      eyebrow="Our work"
      title="Activity images"
      accent="magenta"
      intro="Moments from the movement, captured across our county networks: trainings, convenings, days of activism, and the everyday work of protecting one another."
    >
      <div className="flex flex-wrap gap-2 mb-8">
        {ACTIVE_COUNTIES.map((c) => (
          <span key={c} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink">
            {c}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {GALLERY.map((g, i) => (
          <figure key={i} className="group relative overflow-hidden rounded-2xl border border-line aspect-square">
            <EditableImage id={`activity-images.${i}.image`} src={g.img} alt={g.caption} label={`Gallery photo: ${g.caption}`} wrapperClassName="h-full" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <EditableText as="figcaption" id={`activity-images.${i}.caption`} className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
              {g.caption}
            </EditableText>
          </figure>
        ))}
      </div>
    </PageShell>
  );
}
