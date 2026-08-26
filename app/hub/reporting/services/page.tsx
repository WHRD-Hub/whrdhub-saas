import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Phone, Mail, Globe, LifeBuoy } from "lucide-react";
import { AddServiceForm } from "@/components/reporting/admin/add-service-form";
import { Pill } from "@/components/ui/pill";

const CATEGORY_TONE: Record<string, "purple" | "cyan" | "magenta" | "green" | "amber" | "slate"> = {
  legal: "purple",
  medical: "magenta",
  psychosocial: "cyan",
  shelter: "green",
  digital_security: "purple",
  financial: "amber",
  referral: "cyan",
  other: "slate",
};

async function ServicesList() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("category")
    .order("name");

  if (!services?.length) {
    return (
      <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)] p-12 text-center">
        <Briefcase className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="font-semibold">No services yet</p>
        <p className="text-sm text-muted mt-1">Add support services using the form above.</p>
      </div>
    );
  }

  const byCategory: Record<string, typeof services> = {};
  services.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([cat, svcs]) => (
        <div key={cat}>
          <h3 className="font-bold text-sm uppercase tracking-wide text-muted mb-3 capitalize">
            {cat.replace(/_/g, " ")} ({svcs.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {svcs.map(s => (
              <div key={s.id} className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{s.name}</p>
                    {s.organization && <p className="text-xs text-muted">{s.organization}</p>}
                  </div>
                  <Pill tone={CATEGORY_TONE[s.category] ?? "slate"} className="shrink-0">
                    {s.category.replace(/_/g, " ")}
                  </Pill>
                </div>
                {s.description && <p className="text-xs text-muted">{s.description}</p>}
                <div className="space-y-1 text-xs text-muted">
                  {s.contact_phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.contact_phone}</p>}
                  {s.contact_email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.contact_email}</p>}
                  {s.contact_url && (
                    <a href={s.contact_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-purple hover:underline">
                      <Globe className="w-3 h-3" />Website
                    </a>
                  )}
                  {s.county && <p className="font-medium text-ink">📍 {s.county}</p>}
                </div>
                {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminServicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <LifeBuoy className="h-6 w-6 text-purple" /> Support services
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The directory the referral matcher draws on. A report is matched against these
          the moment it is filed, so a category with no active service means that request
          goes unanswered.
        </p>
      </div>
      <AddServiceForm />
      <Suspense fallback={<div className="text-center text-muted py-8">Loading services...</div>}>
        <ServicesList />
      </Suspense>
    </div>
  );
}
