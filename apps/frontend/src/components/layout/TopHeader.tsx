'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  UserCircle2,
} from 'lucide-react';
import { type CurrentUser } from '@/lib/auth';
import { resolvePageTitle } from '@/lib/nav';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

function roleTone(role?: string): BadgeTone {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'violet';
    case 'MANAGER':
      return 'indigo';
    default:
      return 'slate';
  }
}

function initials(name?: string) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TopHeader({
  user,
  collapsed,
  onToggleCollapse,
  onOpenMobile,
}: {
  user: CurrentUser | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const title = resolvePageTitle(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop collapse */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>

        {/* Breadcrumb / title */}
        <div className="min-w-0">
          <nav className="flex items-center gap-1 text-xs text-slate-400">
            <span>AI Project Hunter</span>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate font-medium text-slate-600">{title}</span>
          </nav>
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {title}
          </h2>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search leads, proposals..."
              className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 lg:w-72"
            />
          </div>

          {/* Add Lead quick action */}
          <Link
            href="/leads"
            className="hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Link>

          {/* Notifications */}
          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 text-left hover:bg-slate-100 sm:pr-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                {initials(user?.name)}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[9rem] truncate text-sm font-medium text-slate-900">
                  {user?.name ?? 'User'}
                </span>
                <span className="block text-xs text-slate-500">
                  {user?.role ?? 'Member'}
                </span>
              </span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-60 origin-top-right animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
                    {initials(user?.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {user?.name ?? 'User'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user?.email ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <Badge tone={roleTone(user?.role)}>
                    {user?.role ?? 'Member'}
                  </Badge>
                </div>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-500"
                  disabled
                >
                  <UserCircle2 className="h-4 w-4" />
                  Profile (coming soon)
                </button>
                <button
                  type="button"
                  onClick={() => router.replace('/login')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          {/* Compact role badge for md+ */}
          <div className="hidden lg:block">
            <Badge tone={roleTone(user?.role)} dot>
              {(user?.role ?? 'Member').toString()}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
