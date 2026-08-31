'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, GraduationCap, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricCard } from '@/components/admin/MetricCard';
import { StatusBadge } from './StatusBadge';
import { CourseForm, type CourseFormValues } from './CourseForm';
import { useCourseLifecycle } from './CourseActions';
import { useCourseApi } from '@/lib/course-api';
import type { CourseSummary } from '@/types/admin';

export function InstructorDashboard({ name }: { name: string }) {
  const api = useCourseApi();
  const queryClient = useQueryClient();
  const { setPublishing, setArchiving, modals } = useCourseLifecycle();

  const [creating, setCreating] = useState(false);

  const metrics = useQuery({
    queryKey: ['instructor', 'metrics'],
    queryFn: api.instructorMetrics,
  });

  const courses = useQuery({
    queryKey: ['courses', 'mine'],
    queryFn: () => api.list({ limit: 50 }),
  });

  const create = useMutation({
    mutationFn: (values: CourseFormValues) =>
      api.create({ ...values, targetAudience: values.targetAudience.join(', ') }),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['instructor'] });
      setCreating(false);
      toast.success(`Created “${course.title}” as a draft`);
    },
    onError: (err: Error) => toast.error('Could not create course', { description: err.message }),
  });

  const rows = courses.data?.data ?? [];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instructor Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome, {name}</p>
        </div>
        <Button onClick={() => setCreating(true)}>Create New Course</Button>
      </div>

      {metrics.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not load metrics. {(metrics.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="My Courses"
          value={metrics.data?.myCourses ?? '—'}
          icon={BookOpen}
          loading={metrics.isPending}
        />
        <MetricCard
          title="Total Students"
          value={metrics.data?.totalStudents ?? '—'}
          icon={Users}
          loading={metrics.isPending}
        />
        <MetricCard
          title="Active Learners"
          value={metrics.data?.activeLearners ?? '—'}
          icon={GraduationCap}
          loading={metrics.isPending}
        />
        <MetricCard
          title="Avg Completion"
          value={metrics.data ? `${(metrics.data.avgCompletion * 100).toFixed(0)}%` : '—'}
          icon={TrendingUp}
          loading={metrics.isPending}
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My Courses</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/instructor/courses">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {courses.isPending ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No courses yet. Create one to get started.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Content</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((course: CourseSummary) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={course.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {course._count.enrollments}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {course._count.content}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/instructor/courses/${course.id}`}>Edit</Link>
                        </Button>
                        {course.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => setPublishing(course)}>
                            Publish
                          </Button>
                        )}
                        {course.status !== 'archived' && (
                          <Button variant="ghost" size="sm" onClick={() => setArchiving(course)}>
                            Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
