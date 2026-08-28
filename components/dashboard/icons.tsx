import {
  LayoutGrid, FileText, MessageCircle, BookOpen, Calendar, Briefcase, Heart, User,
  ShieldCheck, Building2, Users, GitBranch, Sparkles, ClipboardCheck, Megaphone,
  BarChart2, RadioTower, Map as MapIcon, LifeBuoy, Trash2, UserX, UserCog, Gavel,
  Workflow, Bell, PenLine,
} from "lucide-react";

/**
 * The icon set for every navigation surface.
 *
 * Extracted so the sidebar and the mobile bar draw from one table: a nav item
 * that renders as a heart on a laptop and a question mark on a phone is the
 * kind of small wrongness nobody reports and everybody notices.
 */
export const ICONS = {
  overview: LayoutGrid, feed: Sparkles, posts: FileText, messages: MessageCircle,
  resources: BookOpen, calendar: Calendar, services: Briefcase, femtorship: Heart,
  profile: User, verifications: ShieldCheck, organisations: Building2, members: Users,
  matching: GitBranch, reports: FileText, queue: ClipboardCheck, blogs: BookOpen,
  notifications: Bell, compose: PenLine, report: Megaphone,
  // Reporting console
  triage: ShieldCheck, analytics: BarChart2, listening: RadioTower, map: MapIcon,
  support: LifeBuoy, linkages: GitBranch, matchflow: Workflow,
  deleted: Trash2, accounts: UserX, account: UserCog, moderation: Gavel,
} as const;

export interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  badge?: number;
  /**
   * Group heading. Consecutive items sharing a section render under one
   * collapsible heading — which is what keeps an administrator's sidebar from
   * becoming an eighteen-item wall.
   */
  section?: string;
  /** Show in the mobile bottom bar. At most four are used, in order. */
  primary?: boolean;
}
