"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { scanSocialLinks } from "@/app/actions/listening";
import type { Run } from "./types";

/** Check posts someone has sent: paste links to public Instagram or X posts and they are read like any capture. */
export function CheckPanel({ run, busy }: { run: Run; busy: string | null }) {
  const [links, setLinks] = useState("");

  return (
    <section className="card-premium p-5 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-ink">Check a post</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Someone sent you a link? Paste public Instagram or X post links here, one per line. The post is read, sorted like any other capture and added to the inbox. Only the post itself is kept.
      </p>
      <textarea
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        rows={5}
        placeholder={"https://www.instagram.com/p/…\nhttps://x.com/someone/status/…"}
        className="mt-4 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30"
      />
      <button
        onClick={() => run("scan", async () => { const r = await scanSocialLinks(links); if (r && "ok" in r && r.ok) setLinks(""); return r; })}
        disabled={busy !== null || !links.trim()}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-purple px-5 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
      >
        {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check links
      </button>
    </section>
  );
}
