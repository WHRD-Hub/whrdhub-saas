import { Download, FileText, Mail } from "lucide-react";
import { PageShell } from "@/components/page-hero";
import { pageMeta } from "@/lib/seo";
import { getPublishedResources, getPublishedNewsletters} from "@/lib/resources";
import { resourceDate } from "@/lib/resource-types";
import { hubFile } from "@/lib/file-url";

export const metadata = pageMeta({
  title: "Resources & Downloads",
  description:
    "Reports, research, guides, and photo books from the Women Human Rights Defenders Hub.",
  path: "/resources",
});

// Admins add and edit these from /hub/resources, so keep the page fresh.
export const revalidate = 60;

export default async function ResourcesPage() {
  const [items, newsletters] = await Promise.all([getPublishedResources(), getPublishedNewsletters()]);
  const latest = newsletters[0];

  return (
    <PageShell
      eyebrow="Resources"
      title="Resources and downloads"
      accent="purple"
      intro="Our reports, research, policy briefs, and guides, free to read and share. Everything here is produced by the Hub and our partners."
    >
      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <FileText className="w-8 h-8 mx-auto text-purple" />
          <p className="mt-3 font-bold text-ink">Nothing published just yet</p>
          <p className="text-sm text-muted mt-1">New reports and guides will appear here as we publish them.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((r) => (
            <a
              key={r.id}
              href={hubFile(r.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="aspect-[3/4] bg-paper overflow-hidden grid place-items-center">
                {r.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hubFile(r.cover_image_url)}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <FileText className="w-10 h-10 text-muted" />
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{r.kind}</span>
                <h2 className="mt-1 font-bold text-ink text-sm leading-snug">{r.title}</h2>
                {r.description && <p className="mt-1.5 text-xs text-muted line-clamp-3">{r.description}</p>}
                {resourceDate(r) && <p className="mt-1.5 text-xs text-muted">{resourceDate(r)}</p>}
                <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-bold text-purple">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Newsletter highlight */}
      {latest && (
        <div className="mt-14 rounded-3xl border border-line bg-surface overflow-hidden grid sm:grid-cols-[200px_1fr]">
          <div className="bg-paper grid place-items-center">
            {latest.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hubFile(latest.cover_image_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              <Mail className="w-8 h-8 text-muted" />
            )}
          </div>
          <div className="p-8 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-magenta">Newsletter</p>
            <h2 className="mt-2 text-2xl font-black text-ink">{latest.title}</h2>
            <p className="mt-1 text-muted">
              {latest.description ||
                "Read the latest edition for stories and updates from across the movement."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={hubFile(latest.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-purple text-white px-5 py-3 text-sm font-bold hover:bg-purple-600"
              >
                <Download className="w-4 h-4" /> Read the newsletter
              </a>
              {newsletters.length > 1 && (
                <a href="/newsletter" className="text-sm font-bold text-purple">
                  All editions →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
