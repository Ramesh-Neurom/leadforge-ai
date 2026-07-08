export type UserRole = 'ADMIN' | 'MANAGER' | 'BD_EXECUTIVE' | 'FINANCE' | 'TECH_REVIEWER';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
