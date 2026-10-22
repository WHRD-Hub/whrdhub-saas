"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createService } from "@/app/actions/reporting-admin";
import { toast } from "@/components/ui/toast";
import { SERVICE_CATEGORIES, SERVICE_COUNTRIES, KENYA, KENYA_COUNTIES } from "@/lib/reporting-options";

const CATEGORIES = SERVICE_CATEGORIES;

export function AddServiceForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category: "legal", organization: "",
    contact_phone: "", contact_email: "", contact_url: "", county: "", country: "",
  });

  // A service is offered in one county, across a whole country, or everywhere.
  const [scope, setScope] = useState<"county" | "country" | "everywhere">("country");
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) return;
    setLoading(true);
    const result = await createService({
      ...form,
      country: scope === "everywhere" ? "" : form.country || KENYA,
      county: scope === "county" ? form.county : "",
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Service added successfully");
      setForm({ name: "", description: "", category: "legal", organization: "", contact_phone: "", contact_email: "", contact_url: "", county: "", country: "" });
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,21,34,0.04)] overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-paper transition-colors">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-purple" />
          <span className="font-semibold text-sm">Add New Service</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 border-t border-line pt-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Service Name *</label>
              <input required value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="e.g. FIDA Kenya Legal Aid"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Category *</label>
              <select required value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Organization</label>
              <input value={form.organization} onChange={e => set("organization", e.target.value)}
                placeholder="Organization name" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Where is it offered?</label>
              <div className="flex flex-wrap gap-2">
                {([["county", "A county"], ["country", "A whole country"], ["everywhere", "Everywhere"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${scope === v ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {scope !== "everywhere" && (
              <div>
                <label className="block text-xs font-semibold mb-1">Country</label>
                <select value={form.country || KENYA} onChange={e => { set("country", e.target.value); if (e.target.value !== KENYA) set("county", ""); }}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
                  {SERVICE_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {scope === "county" && (
              <div>
                <label className="block text-xs font-semibold mb-1">County</label>
                <select required value={form.county} onChange={e => set("county", e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(form.country || KENYA) !== KENYA && <p className="text-[11px] text-muted mt-1">Counties are listed for Kenya only. Choose Kenya, or offer it across the whole country.</p>}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1">Phone</label>
              <input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)}
                placeholder="+254..." className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Email</label>
              <input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)}
                placeholder="contact@org.org" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Website URL</label>
              <input type="url" value={form.contact_url} onChange={e => set("contact_url", e.target.value)}
                placeholder="https://..." className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
                placeholder="Brief description of the service..."
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple resize-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} size="sm">{loading ? "Adding..." : "Add Service"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
