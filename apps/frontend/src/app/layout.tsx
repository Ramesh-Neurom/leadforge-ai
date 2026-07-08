import type { Metadata } from 'next';
import { Providers } from './providers';
import { AppFrame } from '@/components/layout/AppFrame';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Project Hunter',
  description: 'Freelance project lead collection and proposal management.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
