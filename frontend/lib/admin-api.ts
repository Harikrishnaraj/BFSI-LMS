'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch, NETWORK_ERROR } from './api';
import type {
  AdminUser,
  AuditLogEntry,
  CourseCompliance,
  DashboardMetrics,
  Paginated,
} from '@/types/admin';

/**
 * Every admin call needs a fresh Clerk token, so the client is a hook rather
 * than a module singleton.
 */
export const useAdminApi = () => {
  const { getToken } = useAuth();

  const call = useCallback(
    async <T>(path: string, init: RequestInit = {}) =>
      apiFetch<T>(path, { ...init, token: await getToken() }),
    [getToken]
  );

  return {
    metrics: () => call<DashboardMetrics>('/api/admin/dashboard/metrics'),
    compliance: () => call<{ data: CourseCompliance[] }>('/api/admin/dashboard/compliance'),

    listUsers: (params: Record<string, string | number | undefined>) =>
      call<Paginated<AdminUser>>(`/api/admin/users?${toQuery(params)}`),
    createUser: (body: Record<string, unknown>) =>
      call<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id: string, body: Record<string, unknown>) =>
      call<AdminUser>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deactivateUser: (id: string) =>
      call<AdminUser>(`/api/admin/users/${id}/deactivate`, { method: 'POST' }),

    /**
     * Reports are behind the same Bearer auth as everything else, so they
     * cannot be fetched by pointing the browser at the URL — window.open sends
     * no Authorization header and the endpoint answers 401. Pull the bytes with
     * the token, then hand the browser a blob to save.
     */
    downloadReport: async (downloadUrl: string, filename: string) => {
      let res: Response;
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${downloadUrl}`, {
          headers: { authorization: `Bearer ${await getToken()}` },
        });
      } catch {
        throw new Error(NETWORK_ERROR);
      }
      if (!res.ok) throw new Error(`The report could not be retrieved (${res.status}).`);

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    },

    listAuditLogs: (params: Record<string, string | number | undefined>) =>
      call<Paginated<AuditLogEntry>>(`/api/admin/audit-logs?${toQuery(params)}`),
    exportAuditLogs: (body: Record<string, unknown>) =>
      call<{ reportId: string; downloadUrl: string; generatedAt: string; rows: number }>(
        '/api/admin/audit-logs/export',
        { method: 'POST', body: JSON.stringify(body) }
      ),
  };
};

export const toQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
};
