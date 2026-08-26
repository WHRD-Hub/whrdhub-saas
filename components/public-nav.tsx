"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, Megaphone, Sparkles } from "lucide-react";
import { NAV, links, type NavItem } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

const LOGO = "/main-logo.png";

function DesktopItem({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  if (!item.children) {
    return (
      <Link href={item.href!} className="px-3 py-2 text-sm font-semibold text-ink/80 hover:text-purple transition-colors">
        {item.label}
      </Link>
    );
  }
  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-ink/80 hover:text-purple transition-colors">
        {item.label}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "absolute left-0 top-full pt-2 w-60 transition-all duration-150 origin-top",
          open ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1",
        )}
      >
        <div className="rounded-2xl border border-line bg-surface shadow-xl shadow-purple/5 p-1.5">
          {item.children.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              target={c.external ? "_blank" : undefined}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink/80 hover:bg-purple-050 hover:text-purple transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicNav({ signedIn, isHubAdmin }: { signedIn: boolean; isHubAdmin: boolean }) {
  const [mobile, setMobile] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobile]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="WHRD Hub" className="h-9 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center">
          {NAV.map((item) => <DesktopItem key={item.label} item={item} />)}
          <Link href="/feed" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-ink/80 hover:text-purple transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Feed
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Link
            href={links.reportAbuse}
            className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-3 h-10 text-sm font-bold text-white hover:brightness-95 transition-[filter]"
            title="Securely report an incident"
          >
            <Megaphone className="w-4 h-4" /> Report Abuse
          </Link>
          {signedIn ? (
            <Link href={isHubAdmin ? "/hub" : "/dashboard"} className="inline-flex items-center rounded-xl bg-purple text-white px-4 h-10 text-sm font-bold hover:bg-purple-600">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="inline-flex items-center rounded-xl bg-purple text-white px-4 h-10 text-sm font-bold hover:bg-purple-600">
              Sign In
            </Link>
          )}
        </div>

        <button className="lg:hidden p-2 -mr-2" onClick={() => setMobile(true)} aria-label="Open menu">
          <Menu className="w-6 h-6 text-ink" />
        </button>
      </div>
      </header>

      {/* Mobile drawer — rendered outside the header so its own stacking
          context is not trapped by the header's blur/z-index. */}
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-[90] bg-black/40" onClick={() => setMobile(false)}>
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-surface p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="WHRD Hub" className="h-8 w-auto" />
              <button onClick={() => setMobile(false)} aria-label="Close"><X className="w-6 h-6" /></button>
            </div>
            <nav className="space-y-1">
              <Link href="/feed" onClick={() => setMobile(false)} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-ink">
                <Sparkles className="w-4 h-4 text-purple" /> Feed
              </Link>
              {NAV.map((item) =>
                item.children ? (
                  <div key={item.label}>
                    <button
                      onClick={() => setOpenGroup(openGroup === item.label ? null : item.label)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink"
                    >
                      {item.label}
                      <ChevronDown className={cn("w-4 h-4 transition-transform", openGroup === item.label && "rotate-180")} />
                    </button>
                    {openGroup === item.label && (
                      <div className="pl-3 pb-2 space-y-0.5">
                        {item.children.map((c) => (
                          <Link key={c.label} href={c.href} target={c.external ? "_blank" : undefined} onClick={() => setMobile(false)} className="block px-3 py-2 text-sm text-ink/70 hover:text-purple rounded-lg">
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link key={item.label} href={item.href!} onClick={() => setMobile(false)} className="block px-3 py-2.5 text-sm font-semibold text-ink">
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            <div className="mt-4 pt-4 border-t border-line space-y-2">
              <Link href={links.reportAbuse} onClick={() => setMobile(false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-magenta text-white px-4 h-11 text-sm font-bold">
                <Megaphone className="w-4 h-4" /> Report Abuse
              </Link>
              {signedIn ? (
                <>
                  <Link href={isHubAdmin ? "/hub" : "/dashboard"} onClick={() => setMobile(false)} className="block text-center rounded-xl bg-purple text-white px-4 h-11 leading-[2.75rem] text-sm font-bold">
                    Dashboard
                  </Link>
                  <Link href={links.reportingDashboard} onClick={() => setMobile(false)} className="block text-center rounded-xl border border-line px-4 h-11 leading-[2.75rem] text-sm font-semibold">
                    My reports
                  </Link>
                </>
              ) : (
                <Link href="/login" onClick={() => setMobile(false)} className="block text-center rounded-xl bg-purple text-white px-4 h-11 leading-[2.75rem] text-sm font-bold">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
