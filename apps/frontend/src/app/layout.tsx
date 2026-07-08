import type { Metadata } from 'next';
import Link from 'next/link';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Project Hunter',
  description: 'Freelance project lead collection and proposal management.',
};

const navItems = [
  ['Dashboard', '/dashboard'],
  ['Leads', '/leads'],
  ['Proposals', '/proposals'],
  ['CRM', '/crm'],
  ['Settings', '/settings'],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen">
            <header className="border-b">
              <nav className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-4">
                <Link href="/" className="font-semibold">
                  AI Project Hunter
                </Link>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  {navItems.map(([label, href]) => (
                    <Link key={href} href={href}>
                      {label}
                    </Link>
                  ))}
                </div>
              </nav>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
