import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Phone, Mail, Globe } from "lucide-react";
import { AddServiceForm } from "@/components/reporting/admin/add-service-form";

const CATEGORY_COLORS: Record<string, string> = {
  legal: "bg-blue-100 text-blue-800",
  medical: "bg-green-100 text-green-800",
  psychosocial: "bg-purple-100 text-purple-800",
  shelter: "bg-orange-100 text-orange-800",
  digital_security: "bg-gray-100 text-gray-800",
  financial: "bg-yellow-100 text-yellow-800",
  referral: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-600",
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
      <div className="bg-white rounded-xl border border-line p-12 text-center">
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
              <div key={s.id} className="bg-white rounded-xl border border-line p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    {s.organization && <p className="text-xs text-muted">{s.organization}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.other}`}>
                    {s.category.replace(/_/g, " ")}
                  </span>
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
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-ink mb-1">Support Services</h1>
        <p className="text-muted text-sm">Manage services that can be assigned to verified reports.</p>
      </div>
      <AddServiceForm />
      <Suspense fallback={<div className="text-center text-muted py-8">Loading services...</div>}>
        <ServicesList />
      </Suspense>
    </div>
  );
}
