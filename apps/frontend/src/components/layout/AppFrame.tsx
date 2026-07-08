'use client';

import { usePathname } from 'next/navigation';
import { AdminShell } from './AdminShell';

/**
 * Routes that render WITHOUT the admin shell (their own full-page layout).
 * Everything else is treated as a protected admin page.
 */
const BARE_ROUTES = new Set<string>(['/', '/login']);

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
