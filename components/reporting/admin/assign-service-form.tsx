"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assignService } from "@/app/actions/reporting-admin";
import { toast } from "@/components/ui/toast";

interface Service { id: string; name: string; category: string; organization?: string | null }

export function AssignServiceForm({
  reportId,
  services,
  suggested = [],
  supportRequested = [],
}: {
  reportId: string;
  services: Service[];
  /** Services whose category matches the reporter's requested support. */
  suggested?: Service[];
  /** Raw support_needed values, for the "matched to" hint. */
  supportRequested?: string[];
}) {
  // Preselect the first suggested match so the admin can assign in one click.
  const [serviceId, setServiceId] = useState(suggested[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  const suggestedIds = useMemo(() => new Set(suggested.map(s => s.id)), [suggested]);

  const doAssign = async (id: string, noteText: string) => {
    const result = await assignService(reportId, id, noteText);
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success("Service assigned to this report");
    setAssignedIds(prev => new Set(prev).add(id));
    return true;
  };

  const handleQuickAssign = async (id: string) => {
    setPendingId(id);
    await doAssign(id, "");
    setPendingId(null);
    if (serviceId === id) setServiceId("");
  };

  const handleAssign = async () => {
    if (!serviceId) return;
    setLoading(true);
    const ok = await doAssign(serviceId, note);
    if (ok) {
      setNote("");
      setServiceId("");
    }
    setLoading(false);
  };

  const remainingSuggested = suggested.filter(s => !assignedIds.has(s.id));
  const remainingServices = services.filter(s => !assignedIds.has(s.id));

  if (!remainingServices.length && !remainingSuggested.length) {
    return <p className="text-xs text-muted">All available services have been assigned.</p>;
  }

  const humanSupport = supportRequested.map(s => s.replace(/_/g, " ")).join(", ");

  return (
    <div className="space-y-3 pt-2 border-t border-line">
      {/* ── Auto-matched suggestions ─────────────────────────────── */}
      {remainingSuggested.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-purple uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Matched to support requested
          </p>
          {humanSupport && (
            <p className="text-[11px] text-muted -mt-1">
              Reporter asked for: <span className="font-medium">{humanSupport}</span>. One click to assign.
            </p>
          )}
          <div className="space-y-1.5">
            {remainingSuggested.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleQuickAssign(s.id)}
                disabled={pendingId === s.id}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-purple/30 bg-purple/5 px-3 py-2 text-left text-xs hover:bg-purple/10 transition-colors disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="font-semibold text-ink block truncate">{s.name}</span>
                  <span className="text-muted capitalize">
                    {s.category}{s.organization ? ` · ${s.organization}` : ""}
                  </span>
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 text-purple font-semibold">
                  {pendingId === s.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><Plus className="w-3.5 h-3.5" /> Assign</>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Full picker (fallback / additional services) ─────────── */}
      {remainingServices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase">
            {remainingSuggested.length > 0 ? "Assign another service" : "Assign a service"}
          </p>
          <select
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
          >
            <option value="">Select service...</option>
            {remainingServices.map(s => (
              <option key={s.id} value={s.id}>
                {suggestedIds.has(s.id) ? "★ " : ""}{s.name} ({s.category}){s.organization ? ` - ${s.organization}` : ""}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note to reporter..."
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
          />
          <Button onClick={handleAssign} disabled={!serviceId || loading} size="sm" variant="outline" className="gap-1 w-full">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Assign Service
          </Button>
        </div>
      )}
    </div>
  );
}
