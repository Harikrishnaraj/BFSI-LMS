'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ApiEnrollmentStatus, CourseSummary } from '@/types/admin';

interface CourseCardProps {
  course: CourseSummary;
  status: ApiEnrollmentStatus | 'available';
  progress?: number;
  enrolling?: boolean;
  onEnroll: (course: CourseSummary) => void;
}

const LABELS: Record<string, string> = {
  available: 'Available',
  not_started: 'Enrolled',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export function CourseCard({ course, status, progress = 0, enrolling, onEnroll }: CourseCardProps) {
  const enrolled = status !== 'available';

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-accent p-2 text-accent-foreground" aria-hidden>
              <BookOpen className="h-5 w-5" />
            </span>
            <CardTitle className="text-base">{course.title}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn(
              status === 'completed' && 'text-success',
              status === 'overdue' && 'text-destructive'
            )}
          >
            {LABELS[status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          {course.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {course.owner?.name ?? 'Unassigned'} · {course.difficulty} · {course._count.content}{' '}
            lessons
            {course.complianceType ? ` · ${course.complianceType}` : ''}
          </p>

          {enrolled && status !== 'not_started' && (
            <div>
              <div
                className="h-2 w-full overflow-hidden rounded bg-muted"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${course.title} progress`}
              >
                <div className="h-full rounded bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progress}% complete</p>
            </div>
          )}
        </div>

        {enrolled ? (
          <Button asChild variant={status === 'completed' ? 'outline' : 'default'}>
            <Link href={`/learner/courses/${course.id}/learn`}>
              {status === 'completed' ? 'Re-take' : 'Continue Learning'}
            </Link>
          </Button>
        ) : (
          <Button onClick={() => onEnroll(course)} disabled={enrolling}>
            {enrolling ? 'Enrolling…' : 'Enroll Now'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
