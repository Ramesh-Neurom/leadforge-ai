'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radar, X } from 'lucide-react';
import { navSections, resolveActiveHref } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen
            ? 'opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white shadow-md">
            <Radar className="h-5 w-5" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                AI Project Hunter
              </p>
              <p className="truncate text-[11px] text-sidebar-muted">
                Acquisition suite
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto rounded-md p-1.5 text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title}>
              {!collapsed ? (
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section.title}
                </p>
              ) : (
                <div className="mx-2 mb-2 border-t border-white/10" />
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <li key={`${section.title}-${item.label}`}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0',
                            isActive
                              ? 'text-indigo-300'
                              : 'text-sidebar-muted group-hover:text-white',
                          )}
                        />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer badge */}
        {!collapsed ? (
          <div className="border-t border-white/10 p-3">
            <div className="rounded-lg bg-white/5 px-3 py-2.5">
              <p className="text-[11px] font-medium text-white">
                AI-powered acquisition
              </p>
              <p className="mt-0.5 text-[11px] text-sidebar-muted">
                Automate lead → proposal → win
              </p>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
