import Link from "next/link";
import { FileText, Mail, Plus, EyeOff, Star, CloudOff } from "lucide-react";
import { DataTable, type Column } from "@/components/hub/data-table";
import { Pill } from "@/components/ui/pill";
import { getAllResources } from "@/lib/resources";
import { isStoredHere } from "@/lib/storage";
import { StorageBackfill } from "@/components/hub/storage-backfill";
import { resourceDate, type ResourceItem } from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { hubFile } from "@/lib/file-url";

export const metadata = { title: "Resources — WHRD Hub" };

const TABS = [
  { id: "all", label: "All" },
  { id: "resources", label: "Resources" },
  { id: "newsletters", label: "Newsletters" },
  { id: "hidden", label: "Hidden" },
] as const;

function matches(item: ResourceItem, tab: string) {
  if (tab === "resources") return !item.is_newsletter && item.published;
  if (tab === "newsletters") return item.is_newsletter && item.published;
  if (tab === "hidden") return !item.published;
  return true;
}

export default async function HubResources({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.id === tab) ? (tab as string) : "all";
  const all = await getAllResources();
  const rows = all.filter((r) => matches(r, active));

  // Files still served from an outside site rather than the Hub's own storage.
  const offsite = all.filter(
    (r) => !isStoredHere(r.file_url) || (!!r.cover_image_url && !isStoredHere(r.cover_image_url)),
  ).length;

  const counts: Record<string, number> = {
    all: all.length,
    resources: all.filter((r) => matches(r, "resources")).length,
    newsletters: all.filter((r) => matches(r, "newsletters")).length,
    hidden: all.filter((r) => matches(r, "hidden")).length,
  };

  const columns: Column<ResourceItem>[] = [
    {
      key: "doc",
      header: "Document",
      width: "1.8fr",
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          {r.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hubFile(r.cover_image_url)} alt="" className="w-9 h-12 rounded object-cover border border-line shrink-0" />
          ) : (
            <span className="w-9 h-12 rounded border border-line bg-paper grid place-items-center shrink-0">
              <FileText className="w-4 h-4 text-muted" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate flex items-center gap-1.5">
              {r.featured && <Star className="w-3.5 h-3.5 text-purple shrink-0 fill-current" />}
              {r.title}
            </p>
            <p className="text-xs text-muted truncate">{resourceDate(r) ?? "No date"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "where",
      header: "Shows on",
      width: "160px",
      cell: (r) =>
        r.is_newsletter ? (
          <Pill tone="magenta">
            <Mail className="w-3 h-3" /> Newsletter
          </Pill>
        ) : (
          <Pill tone="cyan">
            <FileText className="w-3 h-3" /> Resources
          </Pill>
        ),
    },
    { key: "kind", header: "Type", width: "120px", cell: (r) => <span className="text-xs text-muted">{r.kind}</span> },
    {
      key: "storage",
      header: "File",
      width: "120px",
      cell: (r) =>
        isStoredHere(r.file_url) ? (
          <span className="text-xs text-muted">In storage</span>
        ) : (
          <Pill tone="amber">
            <CloudOff className="w-3 h-3" /> Offsite
          </Pill>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      cell: (r) =>
        r.published ? (
          <Pill tone="green">Published</Pill>
        ) : (
          <Pill tone="slate">
            <EyeOff className="w-3 h-3" /> Hidden
          </Pill>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Resources &amp; newsletters</h1>
          <p className="text-sm text-muted mt-1">
            Reports, research, guides and photo books for the public Resources page. Tag an item as a
            newsletter to move it to the Newsletter page.
          </p>
        </div>
        <Link
          href="/hub/resources/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600"
        >
          <Plus className="w-4 h-4" /> Add document
        </Link>
      </div>

      <StorageBackfill pending={offsite} />

      <div className="flex gap-1 rounded-xl border border-line bg-paper p-1 w-fit overflow-x-auto">
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <Link
              key={t.id}
              href={t.id === "all" ? "/hub/resources" : `/hub/resources?tab=${t.id}`}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1.5",
                on ? "bg-purple text-white" : "text-ink/70 hover:bg-purple-050",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "text-[11px] font-bold rounded-full px-1.5",
                  on ? "bg-white/25" : "bg-purple-050 text-purple-700",
                )}
              >
                {counts[t.id]}
              </span>
            </Link>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/hub/resources/${r.id}`}
        emptyIcon={FileText}
        emptyTitle="No documents here yet"
        emptySubtitle="Add a report, guide or newsletter and it will appear on the public pages straight away."
        emptyAction={
          <Link
            href="/hub/resources/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600"
          >
            <Plus className="w-4 h-4" /> Add document
          </Link>
        }
      />
    </div>
  );
}
