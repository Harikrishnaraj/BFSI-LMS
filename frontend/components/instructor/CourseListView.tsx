'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from './StatusBadge';
import { CourseForm, type CourseFormValues } from './CourseForm';
import { useCourseLifecycle } from './CourseActions';
import { useCourseApi } from '@/lib/course-api';
import { cn, plural } from '@/lib/utils';
import type { CourseStatus, CourseSummary } from '@/types/admin';

const TABS: { value: '' | CourseStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export function CourseListView() {
  const api = useCourseApi();
  const queryClient = useQueryClient();
  const { setPublishing, setArchiving, modals } = useCourseLifecycle();

  const [tab, setTab] = useState<'' | CourseStatus>('');
  const [creating, setCreating] = useState(false);

  const courses = useQuery({
    queryKey: ['courses', { status: tab }],
    queryFn: () => api.list({ status: tab || undefined, limit: 50, mine: 'true' }),
    placeholderData: (prev) => prev,
  });

  const create = useMutation({
    mutationFn: (values: CourseFormValues) =>
      api.create({ ...values, targetAudience: values.targetAudience.join(', ') }),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setCreating(false);
      toast.success(`Created “${course.title}” as a draft`);
    },
    onError: (err: Error) => toast.error('Could not create course', { description: err.message }),
  });

  const rows = courses.data?.data ?? [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="My Courses" description={plural(courses.data?.total ?? 0, 'course')} />
        <Button onClick={() => setCreating(true)}>Create New Course</Button>
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
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((course: CourseSummary) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <StatusBadge status={course.status} />
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{course.category ?? 'Uncategorised'}</p>
                  <p>
                    {course._count.enrollments} enrolled · {plural(course._count.content, 'item')}
                  </p>
                  <p>Modified {new Date(course.updatedAt).toLocaleDateString()}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/instructor/courses/${course.id}`}>Edit</Link>
                  </Button>
                  {course.status === 'draft' && (
                    <Button size="sm" onClick={() => setPublishing(course)}>
                      Publish
                    </Button>
                  )}
                  {course.status !== 'archived' && (
                    <Button variant="ghost" size="sm" onClick={() => setArchiving(course)}>
                      Archive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CourseForm
        open={creating}
        submitting={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(values) => create.mutate(values)}
      />

      {modals}
    </>
  );
}
