'use client';

import { createContext, useContext } from 'react';
import { type CurrentUser } from '@/lib/auth';

export const AdminUserContext = createContext<CurrentUser | null>(null);

export function useAdminUser() {
  return useContext(AdminUserContext);
}
