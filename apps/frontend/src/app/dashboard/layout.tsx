import { ReactNode } from 'react';

// Auth gating and the global chrome (sidebar/header/footer) are handled by the
// AdminShell in the root layout. This layout is now a simple passthrough.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
