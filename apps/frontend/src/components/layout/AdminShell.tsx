'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { type CurrentUser, getMe } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AdminUserContext } from './admin-context';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { Footer } from './Footer';

const COLLAPSE_KEY = 'aiph.sidebar.collapsed';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let active = true;
    getMe()
      .then((currentUser) => {
        if (!active) return;
        if (!currentUser) {
          router.replace('/login');
          return;
        }
        setUser(currentUser);
        setStatus('ready');
      })
      .catch(() => {
        if (active) router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <AdminUserContext.Provider value={user}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            'flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out',
            collapsed ? 'lg:pl-[72px]' : 'lg:pl-64',
          )}
        >
          <TopHeader
            user={user}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl animate-fade-in">
              {children}
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </AdminUserContext.Provider>
  );
}
