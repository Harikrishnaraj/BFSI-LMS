import type { Role } from './index';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Only present in the response to a create. */
  temporaryPassword?: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeCourses: number;
  completionRate: number;
  complianceStatus: { compliant: number; atRisk: number; nonCompliant: number };
  certificatesExpiringSoon: number;
  lastUpdate: string;
}

export interface CourseCompliance {
  id: string;
  title: string;
  category: string | null;
  assigned: number;
  completed: number;
  completionRate: number;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  details: unknown;
  request_id: string | null;
  timestamp: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
