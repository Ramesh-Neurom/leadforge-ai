import {
  BellRing,
  Briefcase,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Receipt,
  ReceiptText,
  Rss,
  Settings,
  Target,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Target },
      { label: 'Proposals', href: '/proposals', icon: FileText },
      { label: 'CRM Pipeline', href: '/crm', icon: KanbanSquare },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { label: 'Conversations', href: '/conversations', icon: MessagesSquare },
      { label: 'Follow-ups', href: '/followups', icon: BellRing },
      { label: 'Quotations', href: '/quotations', icon: Receipt },
      { label: 'Invoices', href: '/invoices', icon: ReceiptText },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Portfolio', href: '/portfolio', icon: Briefcase },
      { label: 'Lead Sources', href: '/settings', icon: Rss },
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const flatNav = navSections.flatMap((section) => section.items);

/**
 * Resolve the human-readable page title for a given pathname.
 * Falls back gracefully for dynamic/detail routes.
 */
export function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith('/leads/') && pathname !== '/leads') {
    return 'Lead Detail';
  }

  const match = flatNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return match?.label ?? 'AI Project Hunter';
}

/**
 * Returns the href that should be highlighted as active for the current
 * pathname. Uses the longest-prefix match so duplicate targets only light
 * up a single (first) nav entry.
 */
export function resolveActiveHref(pathname: string): string | null {
  let best: string | null = null;
  let bestLength = -1;

  for (const item of flatNav) {
    const isMatch =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (isMatch && item.href.length > bestLength) {
      best = item.href;
      bestLength = item.href.length;
    }
  }

  return best;
}
