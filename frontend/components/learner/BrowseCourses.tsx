'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { CourseCard } from './CourseCard';
import { CATEGORIES, COMPLIANCE_TYPES } from '@/components/instructor/CourseForm';
import { useLearnerApi } from '@/lib/learner-api';
import { cn } from '@/lib/utils';
import type { ApiEnrollmentStatus, CourseSummary } from '@/types/admin';

type Tab = 'available' | 'in_progress' | 'completed';

const TABS: { value: Tab; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export function BrowseCourses() {
  const api = useLearnerApi();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('available');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [complianceType, setComplianceType] = useState('');

  const courses = useQuery({
    queryKey: ['learner', 'courses', { search, category }],
    queryFn: () => api.browse({ search: search || undefined, category: category || undefined, limit: 50 }),
    placeholderData: (prev) => prev,
  });

  const enrollments = useQuery({
    queryKey: ['learner', 'enrollments'],
    queryFn: api.myEnrollments,
  });

  const enroll = useMutation({
    mutationFn: (course: CourseSummary) => api.enroll(course.id),
    onSuccess: (_result, course) => {
      queryClient.invalidateQueries({ queryKey: ['learner'] });
      toast.success(`Enrolled in “${course.title}”`);
    },
    onError: (err: Error) => toast.error('Could not enrol', { description: err.message }),
  });

  const byCourse = new Map(
    (enrollments.data?.data ?? []).map((e) => [e.course_id, e] as const)
  );

  const visible = (courses.data?.data ?? []).filter((course) => {
    if (complianceType && course.complianceType !== complianceType) return false;

    const status = byCourse.get(course.id)?.status;
    if (tab === 'available') return status === undefined;
    if (tab === 'completed') return status === 'completed';
    return status === 'in_progress' || status === 'not_started' || status === 'overdue';
  });

  return (
    <>
      <PageHeader title="Browse Courses" description="Find training and enrol." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="course-search">Search</Label>
          <Input
            id="course-search"
            placeholder="Course name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-category">Category</Label>
          <select
            id="course-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-compliance">Compliance type</Label>
          <select
            id="course-compliance"
            value={complianceType}
            onChange={(e) => setComplianceType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">All types</option>
            {COMPLIANCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b" role="tablist">
        {TABS.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm',
              tab === option.value
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {courses.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not load courses. {(courses.error as Error).message}
        </p>
      )}

      {courses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courses match these filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => {
            const enrollment = byCourse.get(course.id);
            return (
              <CourseCard
                key={course.id}
                course={course}
                status={(enrollment?.status as ApiEnrollmentStatus) ?? 'available'}
                progress={enrollment?.progress_percentage ?? 0}
                enrolling={enroll.isPending && enroll.variables?.id === course.id}
                onEnroll={(c) => enroll.mutate(c)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
