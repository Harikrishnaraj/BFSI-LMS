'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch } from './api';
import { toQuery } from './admin-api';
import type {
  CourseProgress,
  CourseSummary,
  LearnerCertificate,
  LearnerDashboard,
  Lesson,
  MyEnrollment,
  Paginated,
} from '@/types/admin';

export const useLearnerApi = () => {
  const { getToken } = useAuth();

  const call = useCallback(
    async <T>(path: string, init: RequestInit = {}) =>
      apiFetch<T>(path, { ...init, token: await getToken() }),
    [getToken]
  );

  return {
    dashboard: () => call<LearnerDashboard>('/api/learner/dashboard'),
    myEnrollments: () => call<{ data: MyEnrollment[] }>('/api/learner/enrollments'),
    certificates: () => call<{ data: LearnerCertificate[] }>('/api/learner/certificates'),

    browse: (params: Record<string, string | number | undefined>) =>
      call<Paginated<CourseSummary>>(`/api/courses?${toQuery(params)}`),
    course: (id: string) => call<CourseSummary>(`/api/courses/${id}`),
    enroll: (id: string) =>
      call<{ enrollment_id: string }>(`/api/courses/${id}/enroll`, { method: 'POST' }),

    lessons: (id: string) => call<{ lessons: Lesson[] }>(`/api/courses/${id}/lessons`),
    progress: (id: string) => call<CourseProgress>(`/api/courses/${id}/progress`),
    start: (id: string) =>
      call<CourseProgress>(`/api/courses/${id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      }),
    completeLesson: (id: string, lessonId: string) =>
      call<{ lessonId: string; course_progress: number }>(
        `/api/courses/${id}/lessons/${lessonId}/complete`,
        { method: 'POST' }
      ),
    trackTime: (id: string, seconds: number) =>
      call<{ acknowledged: boolean }>(`/api/courses/${id}/time-tracking`, {
        method: 'POST',
        body: JSON.stringify({ seconds_since_last_update: seconds }),
      }),

    scormLaunch: (scormId: string) =>
      call<{ launchUrl: string; token: string; enrollmentId: string }>(
        `/api/scorm/${scormId}/launch-url`,
        { method: 'POST' }
      ),
    scormTrack: (scormId: string, statement: unknown, enrollmentId: string) =>
      call<{ recorded: boolean }>(`/api/scorm/${scormId}/track`, {
        method: 'POST',
        body: JSON.stringify({ statement, enrollmentId }),
      }),
  };
};
