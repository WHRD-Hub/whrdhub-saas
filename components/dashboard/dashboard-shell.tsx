"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, ChevronDown, Search, Bell, LogOut, User, LayoutGrid, Megaphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { links } from "@/lib/site-nav";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { ICONS, type NavItem } from "@/components/dashboard/icons";
import { BottomNav } from "@/components/dashboard/bottom-nav";

export type { NavItem };

const LOGO = "/main-logo.png";

/**
 * Folded sidebar sections, kept in localStorage.
 *
 * A Hub administrator sees eighteen destinations across two consoles. Folding
 * the groups they are not working in today is the difference between a sidebar
 * you scan and one you scroll -- and being made to re-fold the same four groups
 * every morning is its own small tax, so the choice is remembered.
 *
 * Exposed as an external store so the value is read during render instead of
 * being copied in by an effect, which would paint the wrong state first.
 */
const FOLD_KEY = "whrd-nav-folded";
const foldListeners = new Set<() => void>();

function subscribeFolded(listener: () => void) {
  foldListeners.add(listener);
  return () => foldListeners.delete(listener);
}

function readFolded(): string {
  try {
    return localStorage.getItem(FOLD_KEY) ?? "";
  } catch {
    return ""; // private mode: every section simply stays open
  }
}

function writeFolded(value: string) {
  try {
    localStorage.setItem(FOLD_KEY, value);
  } catch {
    /* ignore */
  }
  foldListeners.forEach((l) => l());
}

export function DashboardShell({
  role,
  userName,
  userRole,
  avatarUrl,
  nav,
  title,
  notifCount = 0,
  isAdmin = false,
  children,
}: {
  role: "member" | "admin";
  userName: string;
  userRole: string;
  avatarUrl?: string | null;
  nav: NavItem[];
  title: string;
  notifCount?: number;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  // Which section headings are folded away, read straight from localStorage
  // rather than copied into state by an effect -- that pattern renders once
  // with the wrong value and again with the right one, and on a sidebar the
  // flicker is visible.
  const raw = useSyncExternalStore(subscribeFolded, readFolded, () => "");
  const folded = useMemo<Set<string>>(() => {
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }, [raw]);

  const toggleSection = (section: string) => {
    const next = new Set(folded);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    writeFolded(JSON.stringify([...next]));
  };

  // Title in the top bar follows the active nav item.
  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && href !== "/hub" && pathname.startsWith(href + "/"));

  // The most specific match wins, so /hub/reporting/reports highlights Reports
  // rather than the Reporting overview.
  const activeTitle =
    [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(n.href))?.label ??
    title;

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  const initials = userName.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "W";

  // The bottom bar carries four destinations. Anything marked primary wins;
  // otherwise the first four in the sidebar are a reasonable stand-in, since
  // that order is already the order of importance.
  const flagged = nav.filter((n) => n.primary);
  const bottomItems = (flagged.length ? flagged : nav).slice(0, 4);

  const SideContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-line">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="WHRD Hub" className={cn("w-auto object-contain", collapsed ? "h-8" : "h-9")} />
        </Link>
        <button onClick={() => setCollapsed((c) => !c)} className="hidden lg:inline-flex text-muted hover:text-ink p-1 rounded-lg hover:bg-purple-050" aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User chip + dropdown */}
      <div className="px-3 py-3 border-b border-line relative">
        <button onClick={() => setUserMenu((o) => !o)} className="w-full flex items-center gap-2.5 rounded-xl p-2 hover:bg-purple-050 transition-colors">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-purple text-white grid place-items-center text-xs font-bold shrink-0">{initials}</span>
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 text-left flex-1">
                <span className="block text-sm font-bold text-ink truncate">{userName}</span>
                <span className="block text-xs text-muted truncate">{userRole}</span>
              </span>
              <ChevronDown className={cn("w-4 h-4 text-muted transition-transform", userMenu && "rotate-180")} />
            </>
          )}
        </button>
        {userMenu && (
          <div className="absolute left-3 right-3 top-full mt-1 z-20 rounded-xl border border-line bg-surface shadow-lg p-1.5">
            <Link href="/profile" onClick={() => { setUserMenu(false); setMobileOpen(false); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-purple-050 hover:text-purple-700">
              <User className="w-4 h-4" /> Profile &amp; settings
            </Link>
            {isAdmin && (
              <div className="my-1 border-t border-line pt-1" onClick={() => { setUserMenu(false); setMobileOpen(false); }}>
                <RoleSwitcher variant="menu" />
              </div>
            )}
            <button onClick={signOut} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {nav.map((item, i) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);
          const section = item.section;
          const startsSection = !!section && section !== nav[i - 1]?.section;
          // A folded section keeps any item you are actually on visible --
          // hiding the page somebody is looking at is disorienting, not tidy.
          const hidden = !!section && folded.has(section) && !active && !collapsed;

          return (
            <div key={`${item.href}-wrap`}>
              {startsSection && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section!)}
                  aria-expanded={!folded.has(section!)}
                  className="mt-4 flex w-full items-center gap-1 rounded-lg px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      folded.has(section!) && "-rotate-90",
                    )}
                  />
                  {section}
                </button>
              )}
              {startsSection && collapsed && <div className="my-2 border-t border-line" />}

              {!hidden && (
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-purple-050 text-purple-700"
                      : "text-ink/70 hover:bg-purple-050 hover:text-ink",
                    collapsed && "justify-center",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {/* The active marker reads at a glance when collapsed to icons. */}
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-purple" aria-hidden />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto rounded-full bg-magenta px-2 py-0.5 text-xs font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                  {collapsed && item.badge ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-magenta" aria-hidden />
                  ) : null}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: Report Abuse styled like a nav item. Extra bottom padding
          keeps it clear of the fixed accessibility button in the corner. */}
      <div className="px-3 pt-3 pb-24 border-t border-line">
        <Link href={links.reportAbuse} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/70 hover:bg-purple-050 hover:text-ink transition-colors">
          <Megaphone className="w-5 h-5 shrink-0 text-magenta-700" />
          {!collapsed && "Report Abuse"}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f6fa]">
      {/* Sidebar — desktop */}
      <aside className={cn("hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface border-r border-line transition-[width] duration-200", collapsed ? "w-[76px]" : "w-64")}>
        <SideContent />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <div
            className="rise absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] overflow-hidden bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SideContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur border-b border-line flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-purple-050 shrink-0" aria-label="Menu">
            <LayoutGrid className="w-6 h-6 text-ink" />
          </button>
          <div className="flex items-center gap-2 text-ink font-bold text-base shrink-0">
            <span className="truncate max-w-[45vw]">{activeTitle}</span>
          </div>
          {/* Search on desktop; a flexible spacer on mobile pushes the bell right */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input placeholder="Search..." className="w-full rounded-full border border-line bg-paper pl-9 pr-4 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple/20" />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <Link href={role === "admin" ? "/hub/notifications" : "/dashboard/notifications"} className="relative p-2 rounded-lg hover:bg-purple-050 shrink-0" aria-label="Notifications">
            <Bell className="w-5 h-5 text-ink" />
            {notifCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-magenta text-white text-[10px] font-bold rounded-full grid place-items-center">{notifCount > 9 ? "9+" : notifCount}</span>}
          </Link>
        </header>

        {/* pb-24 on small screens keeps the last row clear of the bottom bar. */}
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">{children}</main>
      </div>

      <BottomNav items={bottomItems} notifCount={notifCount} />
    </div>
  );
}
