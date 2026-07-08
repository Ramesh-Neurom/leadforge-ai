'use client';

import { Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage team members, roles, and access."
      />
      <EmptyState
        title="User management coming soon"
        description="Team member administration and role assignment will be available here."
        icon={Users}
      />
    </div>
  );
}
