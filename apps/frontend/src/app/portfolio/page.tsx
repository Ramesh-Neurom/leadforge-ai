'use client';

import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Showcase case studies and past projects attached to proposals."
      />
      <EmptyState
        title="No portfolio items yet"
        description="Portfolio management is coming soon. Portfolio links can be attached to proposals from the lead detail page."
        icon={Briefcase}
      />
    </div>
  );
}
