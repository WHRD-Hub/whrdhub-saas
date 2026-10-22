"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft, ChevronRight, ChevronDown, Bell, LogOut, User, Menu, Megaphone, Accessibility,
} from "lucide-react";
import { signOut as signOutAction } from "@/app/actions/auth";
import { links } from "@/lib/site-nav";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { ICONS, type NavItem } from "@/components/dashboard/icons";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { Modal } from "@/components/ui/modal";
import { AccessibilityControls } from "@/components/accessibility-controls";

export type { NavItem };

const LOGO = "/main-logo.png";

/**
 * The console frame.
 *
 * A sidebar has to be scanned, not read. Three things keep it that way:
 *   - One area at a time. An administrator belongs to two consoles (community
 *     and reporting); showing both at once is what made it a wall. A switch at
 *     the top moves between them.
 *   - The everyday pages are listed; the rarely used ones sit under "More".
 *   - The person, their settings and accessibility live in one menu at the
 *     bottom instead of being scattered across the screen.
 */
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
  const dense = pathname === "/hub/reporting/listening" || pathname.startsWith("/hub/reporting/reports/");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && href !== "/hub" && pathname.startsWith(href + "/"));

  // The most specific match wins, so /hub/reporting/reports highlights Reports
  // rather than the Reporting overview.
  const activeItem = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(n.href));
  const activeTitle = activeItem?.label ?? title;

  // Areas: only when items declare one. The area you are in follows the page you are on.
  const areas = useMemo(() => [...new Set(nav.map((n) => n.area).filter(Boolean) as string[])], [nav]);
  const area = areas.length > 1 ? (activeItem?.area ?? areas[0]) : undefined;
  const visible = area ? nav.filter((n) => n.area === area) : nav;
  const main = visible.filter((n) => !n.secondary);
  const more = visible.filter((n) => n.secondary);
  const moreActive = more.some((n) => isActive(n.href));
  const showMore = moreOpen || moreActive;

  const initials = userName.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "W";

  // The bottom bar carries four destinations from the area you are in.
  const flagged = visible.filter((n) => n.primary);
  const bottomItems = (flagged.length ? flagged : visible).slice(0, 4);

  const renderItem = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
          active ? "bg-purple-050 font-semibold text-purple-700" : "font-medium text-ink/65 hover:bg-paper hover:text-ink",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="ml-auto rounded-full bg-magenta/10 px-1.5 text-[11px] font-bold leading-5 text-magenta-700">{item.badge}</span>
        ) : null}
        {collapsed && item.badge ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-magenta" aria-hidden /> : null}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex min-w-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="WHRD Hub" className={cn("w-auto object-contain", collapsed ? "h-7" : "h-8")} />
        </Link>
        <button onClick={() => setCollapsed((c) => !c)} className="hidden rounded-md p-1 text-muted/70 hover:bg-paper hover:text-ink lg:inline-flex" aria-label="Collapse sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Area switch, for people who work in more than one console */}
      {areas.length > 1 && !collapsed && (
        <div className="px-3 pb-2">
          <div role="tablist" aria-label="Console area" className="flex rounded-xl bg-paper p-1">
            {areas.map((a) => {
              const first = nav.find((n) => n.area === a);
              const on = a === area;
              return (
                <Link
                  key={a}
                  href={first?.href ?? "/hub"}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-colors",
                    on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {a}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {main.map((item, i) => {
          const startsSection = !!item.section && item.section !== main[i - 1]?.section;
          return (
            <div key={item.href}>
              {startsSection && !collapsed && (
                <p className={cn("px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted/80", i > 0 ? "mt-5" : "mt-1")}>{item.section}</p>
              )}
              {startsSection && collapsed && i > 0 && <div className="my-2 border-t border-line" />}
              {renderItem(item)}
            </div>
          );
        })}

        {more.length > 0 && !collapsed && (
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={showMore}
              className="flex w-full items-center gap-1.5 px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted/80 hover:text-ink"
            >
              More <ChevronDown className={cn("h-3 w-3 transition-transform", showMore && "rotate-180")} />
            </button>
            {showMore && <div className="space-y-0.5">{more.map(renderItem)}</div>}
          </div>
        )}
        {more.length > 0 && collapsed && <div className="space-y-0.5 pt-2">{more.map(renderItem)}</div>}
      </nav>

      {/* The person: one quiet menu at the bottom */}
      <div className="relative border-t border-line/70 p-3">
        {userMenu && (
          <div className="absolute inset-x-3 bottom-full z-20 mb-1 rounded-xl border border-line bg-surface p-1.5 shadow-premium">
            <Link href="/profile" onClick={() => { setUserMenu(false); setMobileOpen(false); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper hover:text-ink">
              <User className="h-4 w-4" /> Profile &amp; settings
            </Link>
            <button type="button" onClick={() => { setUserMenu(false); setMobileOpen(false); setA11yOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper hover:text-ink">
              <Accessibility className="h-4 w-4" /> Accessibility
            </button>
            <Link href={links.reportAbuse} onClick={() => { setUserMenu(false); setMobileOpen(false); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-paper hover:text-ink">
              <Megaphone className="h-4 w-4" /> Report abuse
            </Link>
            {isAdmin && (
              <div className="my-1 border-t border-line pt-1" onClick={() => { setUserMenu(false); setMobileOpen(false); }}>
                <RoleSwitcher variant="menu" />
              </div>
            )}
            {/* Server action: the cookie is cleared before the response, rather than in the browser and hoped for afterwards. */}
            <form action={signOutAction} className="mt-1 border-t border-line pt-1">
              <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        )}
        <button
          onClick={() => setUserMenu((o) => !o)}
          aria-expanded={userMenu}
          className={cn("flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-paper", collapsed && "justify-center")}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple text-[11px] font-bold text-white">{initials}</span>
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{userName}</span>
                <span className="block truncate text-[11px] text-muted">{userRole}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", userMenu && "rotate-180")} />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      {/* Sidebar, desktop */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line/70 bg-surface transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-60")}>
        {sidebar}
      </aside>

      {/* Sidebar, mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} role="presentation">
          <div className="rise absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line/70 bg-surface/80 px-4 backdrop-blur sm:px-8">
          <button onClick={() => setMobileOpen(true)} className="-ml-1 shrink-0 rounded-lg p-2 hover:bg-paper lg:hidden" aria-label="Menu">
            <Menu className="h-5 w-5 text-ink" />
          </button>
          <p className="truncate text-[17px] font-semibold tracking-tight text-ink">{activeTitle}</p>
          <div className="flex-1" />
          <Link href={role === "admin" ? "/hub/notifications" : "/dashboard/notifications"} className="relative shrink-0 rounded-lg p-2 hover:bg-paper" aria-label="Notifications">
            <Bell className="h-5 w-5 text-ink/80" />
            {notifCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white">{notifCount > 9 ? "9+" : notifCount}</span>
            )}
          </Link>
        </header>

        {/* pb-24 on small screens keeps the last row clear of the bottom bar. */}
        {/* Working screens (the listening inbox and a case) trade margin for detail: wider, and almost no space above the content. */}
        <main className={cn("mx-auto px-4 pb-24 sm:px-8 lg:pb-8", dense ? "max-w-[1480px] pt-3 sm:px-6" : "max-w-6xl pt-8 lg:pb-10")}>{children}</main>
      </div>

      <BottomNav items={bottomItems} notifCount={notifCount} />

      <Modal open={a11yOpen} onClose={() => setA11yOpen(false)} title="Accessibility" subtitle="Make the Hub easier to read and use. Saved on this device.">
        <AccessibilityControls />
      </Modal>
    </div>
  );
}
