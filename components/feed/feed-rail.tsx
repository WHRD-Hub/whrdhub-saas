"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, BookOpen, Heart, ShieldCheck, Building2, FileText, Megaphone,
  Newspaper, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface RailLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  primary?: boolean;
}

const LINKS: RailLink[] = [
  { label: "Feed", href: "/feed", icon: Home, tint: "text-purple", primary: true },
  { label: "County networks", href: "/counties", icon: Users, tint: "text-cyan-700", primary: true },
  { label: "Stories", href: "/blog", icon: BookOpen, tint: "text-magenta-700", primary: true },
  { label: "Femtorship", href: "/mentorship", icon: Heart, tint: "text-magenta-700", primary: true },
  { label: "My reports", href: "/dashboard/reports", icon: ShieldCheck, tint: "text-purple", primary: true },
  { label: "Organisations", href: "/organizations", icon: Building2, tint: "text-cyan-700" },
  { label: "Resources", href: "/resources", icon: FileText, tint: "text-purple" },
  { label: "Newsletter", href: "/newsletter", icon: Newspaper, tint: "text-magenta-700" },
  { label: "Opportunities", href: "/opportunities", icon: Megaphone, tint: "text-cyan-700" },
];

/**
 * The left rail. Mirrors the shape of a social feed's navigation: the person
 * at the top, then the places they go, with the long tail behind "See more".
 */
export function FeedRail({
  userName,
  avatarUrl,
  signedIn,
}: {
  userName?: string | null;
  avatarUrl?: string | null;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? LINKS : LINKS.filter((l) => l.primary);

  return (
    <nav aria-label="Feed navigation" className="space-y-0.5">
      {signedIn ? (
        <Link
          href="/profile"
          className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-purple-050"
        >
          <Avatar name={userName ?? "You"} src={avatarUrl} size={36} />
          <span className="truncate text-[15px] font-semibold text-ink">
            {userName || "Your profile"}
          </span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-purple-050"
        >
          <Avatar name="?" size={36} />
          <span className="text-[15px] font-semibold text-ink">Sign in</span>
        </Link>
      )}

      {shown.map(({ label, href, icon: Icon, tint }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium transition-colors",
              active ? "bg-purple-050 font-semibold text-purple-700" : "text-ink hover:bg-purple-050",
            )}
          >
            <Icon className={cn("h-6 w-6 shrink-0", active ? "text-purple-700" : tint)} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium text-ink transition-colors hover:bg-purple-050"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-050 text-purple">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        {expanded ? "See less" : "See more"}
      </button>

      <div className="mt-3 border-t border-line pt-3">
        <Link
          href="/report"
          className="flex items-center gap-2 rounded-xl bg-magenta px-3 py-2.5 text-sm font-bold text-white transition-[filter] hover:brightness-95"
        >
          <Megaphone className="h-5 w-5" /> Report abuse
        </Link>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted">
          Confidential. You do not need an account.
        </p>
      </div>
    </nav>
  );
}
