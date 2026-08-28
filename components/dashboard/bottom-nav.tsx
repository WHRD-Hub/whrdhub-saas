"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS, type NavItem } from "@/components/dashboard/icons";
import { links } from "@/lib/site-nav";

/**
 * The mobile navigation bar.
 *
 * A drawer behind a hamburger is fine on a laptop and poor on a phone: it hides
 * every destination behind a tap and a wait. This puts the four places people
 * actually go within thumb reach, and gives Report Abuse the raised centre
 * position — on a platform where the urgent case is somebody in danger, the
 * most important action should not be two taps inside a menu.
 *
 * Shown below `lg`, which is exactly where the sidebar disappears, so there is
 * never a viewport with both or neither.
 */
export function BottomNav({ items, notifCount = 0 }: { items: NavItem[]; notifCount?: number }) {
  const pathname = usePathname();
  const four = items.slice(0, 4);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && href !== "/hub" && pathname.startsWith(href + "/"));

  const Item = ({ item }: { item: NavItem }) => {
    const Icon = ICONS[item.icon];
    const active = isActive(item.href);
    const badge = item.badge ?? (item.icon === "notifications" ? notifCount : 0);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 min-w-0"
      >
        <span className="relative">
          <Icon className={cn("h-5 w-5 transition-colors", active ? "text-purple" : "text-muted")} />
          {badge > 0 && (
            <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className={cn("truncate text-[10px] font-semibold", active ? "text-purple" : "text-muted")}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      // Respect the home-indicator inset on iOS rather than sitting under it.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1">
        {four.slice(0, 2).map((item) => (
          <Item key={item.href} item={item} />
        ))}

        <div className="flex w-16 shrink-0 items-start justify-center">
          <Link
            href={links.reportAbuse}
            aria-label="Report abuse"
            className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-magenta text-white shadow-lg shadow-magenta/30 ring-4 ring-[#f7f6fa] transition-transform active:scale-95"
          >
            <Megaphone className="h-6 w-6" />
          </Link>
        </div>

        {four.slice(2, 4).map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
