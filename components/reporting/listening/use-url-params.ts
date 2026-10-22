"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The address bar as state, for lists the server filters and pages. Changing a
 * filter resets the page number, so a narrower list never opens on an empty page 4.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const get = (key: string) => sp.get(key) ?? "";

  const set = (changes: Record<string, string | null>, opts: { keepPage?: boolean } = {}) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!opts.keepPage) p.delete("page");
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return { get, set, pending };
}
