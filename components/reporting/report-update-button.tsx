"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { KENYA_COUNTIES, OTHER_COUNTRIES } from "@/lib/reporting-options";
import { updateReportDetails, type ReportDetailsInput } from "@/app/actions/report-update";

const SELECT =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/40";

/** Lets a reporter correct what they told us, such as a changed phone number. */
export function ReportUpdateButton({ reportId, initial }: { reportId: string; initial: ReportDetailsInput }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<ReportDetailsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof ReportDetailsInput, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateReportDetails(reportId, f);
      if ("error" in res) { setError(res.error); return; }
      toast.success("Your report has been updated.");
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine className="h-3.5 w-3.5" /> Update
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Update your report"
        subtitle="Correct anything that has changed, like a phone number or the place it happened."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="upd-contact-method">How can we reach you?</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <select id="upd-contact-method" value={f.contact_method} onChange={(e) => set("contact_method", e.target.value)} className={SELECT}>
                <option value="">Prefer not to be contacted</option>
                <option value="phone">Phone call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
              <Input
                value={f.contact_value}
                onChange={(e) => set("contact_value", e.target.value)}
                placeholder="Phone number or email"
                aria-label="Phone number or email"
                inputMode="text"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="upd-description">What happened</Label>
            <Textarea id="upd-description" rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="upd-county">County / country</Label>
              <select id="upd-county" value={f.county} onChange={(e) => set("county", e.target.value)} className={SELECT}>
                <option value="">Select</option>
                <optgroup label="Kenya: counties">
                  {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Other countries">
                  {OTHER_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <Label htmlFor="upd-location">Place</Label>
              <Input id="upd-location" value={f.location_description} onChange={(e) => set("location_description", e.target.value)} placeholder="e.g. home, workplace, a street" />
            </div>
            <div>
              <Label htmlFor="upd-date">Date</Label>
              <Input id="upd-date" type="date" value={f.occurred_at} max={new Date().toISOString().split("T")[0]} onChange={(e) => set("occurred_at", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="upd-time">Time</Label>
              <Input id="upd-time" type="time" value={f.occurred_time} onChange={(e) => set("occurred_time", e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="upd-perp">Details about who did this</Label>
            <Input id="upd-perp" value={f.perpetrator_detail} onChange={(e) => set("perpetrator_detail", e.target.value)} placeholder="Name, title, organisation, or any identifying detail" />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </Modal>
    </>
  );
}
