'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch } from './api';
import { toQuery } from './admin-api';
import type {
  CourseContentItem,
  CourseDetail,
  CourseEnrollment,
  CourseSummary,
  InstructorMetrics,
  Paginated,
  PublishCheck,
} from '@/types/admin';

export const useCourseApi = () => {
  const { getToken } = useAuth();

  const call = useCallback(
    async <T>(path: string, init: RequestInit = {}) =>
      apiFetch<T>(path, { ...init, token: await getToken() }),
    [getToken]
  );

  return {
    instructorMetrics: () => call<InstructorMetrics>('/api/instructor/dashboard/metrics'),

    list: (params: Record<string, string | number | undefined>) =>
      call<Paginated<CourseSummary>>(`/api/courses?${toQuery(params)}`),
    get: (id: string) => call<CourseDetail>(`/api/courses/${id}`),
    create: (body: Record<string, unknown>) =>
      call<CourseSummary>('/api/courses', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      call<CourseSummary>(`/api/courses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    archive: (id: string) => call<CourseSummary>(`/api/courses/${id}`, { method: 'DELETE' }),
    publishChecks: (id: string) =>
      call<{ checks: PublishCheck[]; ready: boolean }>(`/api/courses/${id}/publish-checks`),
    publish: (id: string) =>
      call<CourseSummary>(`/api/courses/${id}/publish`, { method: 'POST' }),

    addContent: (id: string, body: Record<string, unknown>) =>
      call<CourseContentItem>(`/api/courses/${id}/content`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateContent: (id: string, contentId: string, body: Record<string, unknown>) =>
      call<CourseContentItem>(`/api/courses/${id}/content/${contentId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    deleteContent: (id: string, contentId: string) =>
      call<{ success: boolean }>(`/api/courses/${id}/content/${contentId}`, { method: 'DELETE' }),
    reorderContent: (id: string, order: string[]) =>
      call<{ success: boolean }>(`/api/courses/${id}/content/reorder`, {
        method: 'POST',
        body: JSON.stringify({ order }),
      }),

    enrollments: (id: string, params: Record<string, string | number | undefined>) =>
      call<Paginated<CourseEnrollment>>(`/api/courses/${id}/enrollments?${toQuery(params)}`),
    enroll: (id: string) =>
      call<{ enrollment_id: string }>(`/api/courses/${id}/enroll`, { method: 'POST' }),
  };
};
