"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createService } from "@/app/actions/reporting-admin";
import { toast } from "@/components/ui/toast";

const CATEGORIES = ["legal","medical","psychosocial","shelter","digital_security","financial","referral","other"];
const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Kilifi","Kakamega","All Counties"];

export function AddServiceForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category: "legal", organization: "",
    contact_phone: "", contact_email: "", contact_url: "", county: "",
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) return;
    setLoading(true);
    const result = await createService(form);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Service added successfully");
      setForm({ name: "", description: "", category: "legal", organization: "", contact_phone: "", contact_email: "", contact_url: "", county: "" });
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-line overflow-hidden">
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
            <div>
              <label className="block text-xs font-semibold mb-1">County</label>
              <select value={form.county} onChange={e => set("county", e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple">
                <option value="">Select county</option>
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
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
