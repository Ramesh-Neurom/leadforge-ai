'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { CurrentUser, getMe } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then((currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }

      setUser(currentUser);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-600">Welcome, {user?.name}</p>
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">{user?.name}</span>
          <span className="ml-2 text-slate-500">{user?.role}</span>
        </div>
      </header>
      {children}
    </section>
  );
}
