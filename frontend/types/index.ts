export type Role = 'admin' | 'instructor' | 'learner';

export const ROLES: Role[] = ['admin', 'instructor', 'learner'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  isActive: boolean;
}

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status: 'draft' | 'published' | 'archived';
  isMandatory: boolean;
  complianceType?: string | null;
  version: number;
}

export interface ApiError {
  error: string;
  requestId?: string;
}
