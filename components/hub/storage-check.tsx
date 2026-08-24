"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Line = { ok: boolean; text: string };

/**
 * Runs the exact path an upload takes — session, then a tiny probe file written
 * to the bucket and removed again — and reports where it breaks. This is here
 * because a failed upload used to look identical to nothing happening at all.
 */
export function StorageCheck({ bucket = "publications" }: { bucket?: string }) {
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);

  const run = async () => {
    setBusy(true);
    setLines(null);
    const out: Line[] = [];

    try {
      const supabase = createClient();

      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth?.user) {
        out.push({ ok: false, text: `Signed in: no — ${authErr?.message ?? "no session in this browser"}` });
        setLines(out);
        return;
      }
      out.push({ ok: true, text: "Signed in: yes" });

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("is_hub_admin")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profErr) {
        out.push({ ok: false, text: `Hub admin: could not read your profile — ${profErr.message}` });
      } else if (profile?.is_hub_admin) {
        out.push({ ok: true, text: "Hub admin: yes" });
      } else {
        out.push({
          ok: false,
          text: "Hub admin: no. Set is_hub_admin = true on your profiles row, or storage will refuse the upload.",
        });
      }

      // Write a tiny file and delete it — the same call an upload makes.
      const path = `diagnostics/probe-${Date.now()}.txt`;
      const probe = new Blob(["storage check"], { type: "text/plain" });
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, probe, { upsert: true, contentType: "text/plain" });

      if (upErr) {
        const m = upErr.message.toLowerCase();
        const hint = m.includes("bucket not found")
          ? ` The "${bucket}" bucket does not exist — run supabase/012_publications_bucket.sql.`
          : m.includes("row-level security") || m.includes("unauthorized")
            ? " Storage policies rejected the write — re-run supabase/012_publications_bucket.sql and confirm your admin flag."
            : "";
        out.push({ ok: false, text: `Write to "${bucket}": failed — ${upErr.message}.${hint}` });
      } else {
        out.push({ ok: true, text: `Write to "${bucket}": yes` });
        const { error: delErr } = await supabase.storage.from(bucket).remove([path]);
        out.push(
          delErr
            ? { ok: false, text: `Cleanup: left the probe file behind — ${delErr.message}` }
            : { ok: true, text: "Cleanup: probe file removed" },
        );
      }
    } catch (e) {
      out.push({ ok: false, text: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setLines(out);
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:underline disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
        {busy ? "Checking…" : "Uploads not working? Run a storage check"}
      </button>

      {lines && (
        <ul className="mt-2 space-y-1 rounded-lg border border-line bg-paper p-3">
          {lines.map((l, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5">
              {l.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className={l.ok ? "text-muted" : "text-rose-700 font-semibold"}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
