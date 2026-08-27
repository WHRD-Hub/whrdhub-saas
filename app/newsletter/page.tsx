import { Download, Mail } from "lucide-react";
import { PageShell } from "@/components/page-hero";
import { pageMeta } from "@/lib/seo";
import { getPublishedNewsletters} from "@/lib/resources";
import { resourceDate } from "@/lib/resource-types";
import { hubFile } from "@/lib/file-url";

export const metadata = pageMeta({
  title: "Newsletter",
  description: "Pulse of Progress, the Hub's bi-annual newsletter.",
  path: "/newsletter",
});

// Admins publish editions from /hub/resources, so keep the page fresh.
export const revalidate = 60;

export default async function NewsletterPage() {
  const editions = await getPublishedNewsletters();
  const [latest, ...past] = editions;

  return (
    <PageShell
      eyebrow="Resources"
      title="Newsletter"
      accent="magenta"
      intro="Pulse of Progress is our bi-annual newsletter, sharing stories, milestones, and updates from across the county networks."
    >
      {!latest ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <Mail className="w-8 h-8 mx-auto text-magenta" />
          <p className="mt-3 font-bold text-ink">No editions published yet</p>
          <p className="text-sm text-muted mt-1">The next edition will appear here as soon as it is out.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-10 items-start">
          <div className="rounded-3xl overflow-hidden border border-line shadow-xl shadow-purple/10 bg-paper grid place-items-center">
            {latest.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hubFile(latest.cover_image_url)} alt={latest.title} className="w-full object-cover" />
            ) : (
              <Mail className="w-12 h-12 text-muted my-20" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
              {resourceDate(latest) ?? "Latest edition"}
            </p>
            <h2 className="mt-2 text-3xl font-black text-ink">{latest.title}</h2>
            <p className="mt-3 text-muted leading-relaxed max-w-xl">
              {latest.description ||
                "Read about the work happening across the movement: the trainings, the convenings, the partnerships, and the defenders at the heart of it all."}
            </p>
            <a
              href={hubFile(latest.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple text-white px-6 py-3.5 text-sm font-bold hover:bg-purple-600"
            >
              <Download className="w-4 h-4" /> Read the newsletter
            </a>

            <div className="mt-10 rounded-2xl border border-line bg-surface p-6 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-magenta-050 text-magenta flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-ink">Never miss an edition</h3>
                <p className="text-sm text-muted mt-1">
                  Members receive the newsletter straight to their dashboard. Join the Hub to stay in
                  the loop.
                </p>
                <a href="/signup" className="mt-3 inline-flex text-sm font-bold text-purple">
                  Join the Hub →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-black text-ink">Past editions</h2>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {past.map((n) => (
              <a
                key={n.id}
                href={hubFile(n.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-line bg-surface overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="aspect-[3/4] bg-paper overflow-hidden grid place-items-center">
                  {n.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hubFile(n.cover_image_url)}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <Mail className="w-10 h-10 text-muted" />
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-magenta">
                    {resourceDate(n) ?? "Edition"}
                  </span>
                  <h3 className="mt-1 font-bold text-ink text-sm leading-snug">{n.title}</h3>
                  <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-bold text-purple">
                    <Download className="w-3.5 h-3.5" /> Read
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
