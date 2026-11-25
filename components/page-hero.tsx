import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EditableText } from "@/components/site-edit/editable-text";
import { EditableImage } from "@/components/site-edit/editable-image";

type Accent = "purple" | "magenta" | "cyan";
const eyebrowColor: Record<Accent, string> = {
  purple: "text-purple",
  magenta: "text-magenta",
  cyan: "text-cyan-700",
};

/**
 * Shared stencil for every public route. Header + a vibrant brand-wash hero
 * (matching the landing) + page body + footer, so all marketing pages feel of a
 * piece. Pass `image` to show a photo alongside the hero text.
 *
 * The eyebrow, title, intro and photo can be changed in edit mode. `editKey`
 * names the page for that (defaults to the title); keep it stable once set, or
 * the edits made under the old name stop showing.
 */
export function PageShell({
  eyebrow,
  title,
  intro,
  accent = "purple",
  image,
  editKey,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  accent?: Accent;
  image?: string;
  editKey?: string;
  children: React.ReactNode;
}) {
  const key = `page.${editKey ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="brand-wash border-b border-line">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 ${image ? "grid lg:grid-cols-2 gap-10 items-center" : ""}`}>
          <div>
            <EditableText as="p" id={`${key}.eyebrow`} className={`text-xs font-bold uppercase tracking-wider ${eyebrowColor[accent]}`}>{eyebrow}</EditableText>
            <EditableText as="h1" id={`${key}.title`} className="mt-3 text-4xl lg:text-5xl font-black text-ink leading-[1.05]">{title}</EditableText>
            {intro && <EditableText as="p" id={`${key}.intro`} multiline className="mt-4 text-lg text-muted leading-relaxed max-w-2xl">{intro}</EditableText>}
          </div>
          {image && (
            <div className="rounded-3xl overflow-hidden border border-line shadow-xl shadow-purple/10">
              <EditableImage id={`${key}.image`} src={image} alt="" label={`Photo beside the heading of the ${title} page`} className="w-full h-80 object-cover" />
            </div>
          )}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-16">{children}</main>

      <SiteFooter />
    </div>
  );
}
