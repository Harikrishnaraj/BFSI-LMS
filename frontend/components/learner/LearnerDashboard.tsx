'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { CertificateCard } from './CertificateCard';
import { useLearnerApi } from '@/lib/learner-api';
import { cn } from '@/lib/utils';
import type { ApiEnrollmentStatus } from '@/types/admin';

const STATUS_LABEL: Record<ApiEnrollmentStatus, string> = {
  not_started: 'Not Started ❌',
  in_progress: 'In Progress',
  completed: 'Completed ✅',
  overdue: 'Overdue ❌',
};

export function LearnerDashboard({ name }: { name: string }) {
  const api = useLearnerApi();

  const dashboard = useQuery({ queryKey: ['learner', 'dashboard'], queryFn: api.dashboard });
  const data = dashboard.data;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Learning Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome, {name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/learner/courses">Browse Courses</Link>
          </Button>
          {data?.continueCourseId && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/learner/courses/${data.continueCourseId}/learn`}>Continue Learning</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/learner/certificates">Download Certificates</Link>
          </Button>
        </div>
      </div>

      {dashboard.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not load your dashboard. {(dashboard.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Courses in Progress"
          value={data?.coursesInProgress ?? '—'}
          icon={BookOpen}
          loading={dashboard.isPending}
        />
        <MetricCard
          title="Courses Completed"
          value={data?.coursesCompleted ?? '—'}
          icon={CheckCircle2}
          loading={dashboard.isPending}
        />
        <MetricCard
          title="Learning Hours"
          value={data?.learningHours ?? '—'}
          icon={Clock}
          loading={dashboard.isPending}
        />
        <MetricCard
          title="Active Certificates"
          value={data?.activeCertificates ?? '—'}
          icon={Award}
          loading={dashboard.isPending}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Mandatory Courses Required</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.isPending ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : (data?.mandatoryCourses.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mandatory training assigned to you right now.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.mandatoryCourses.map((row) => (
                    <TableRow key={row.enrollmentId}>
                      <TableCell className="font-medium">{row.course.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            row.status === 'completed' && 'text-success',
                            row.overdue && 'text-destructive'
                          )}
                        >
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(row.overdue && 'font-medium text-destructive')}>
                        {row.due_at ? new Date(row.due_at).toLocaleDateString() : 'No deadline'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status !== 'completed' && (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/learner/courses/${row.course.id}/learn`}>Quick Start</Link>
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

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My Certificates</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/learner/certificates">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {dashboard.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (data?.certificates.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t earned any certificates yet. Complete a course to get started!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data?.certificates.slice(0, 3).map((certificate) => (
                <CertificateCard key={certificate.id} certificate={certificate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
