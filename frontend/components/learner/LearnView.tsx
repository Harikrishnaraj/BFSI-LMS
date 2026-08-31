'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CoursePlayer } from './CoursePlayer';
import { useTimeTracker } from './useTimeTracker';
import { useLearnerApi } from '@/lib/learner-api';
import { cn } from '@/lib/utils';

export function LearnView({ courseId }: { courseId: string }) {
  const api = useLearnerApi();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);

  const lessons = useQuery({
    queryKey: ['learner', 'lessons', courseId],
    queryFn: () => api.lessons(courseId),
  });

  const progress = useQuery({
    queryKey: ['learner', 'progress', courseId],
    queryFn: () => api.progress(courseId),
  });

  const start = useMutation({ mutationFn: () => api.start(courseId) });
  const started = useRef(false);

  // Mark the course started exactly once. Keyed off a ref rather than the
  // mutation's own flags: those reset on error, which would retry forever.
  const startMutate = start.mutate;
  useEffect(() => {
    if (!lessons.isSuccess || started.current) return;
    started.current = true;
    startMutate();
  }, [lessons.isSuccess, startMutate]);

  useTimeTracker(courseId, lessons.isSuccess);

  const complete = useMutation({
    mutationFn: (lessonId: string) => api.completeLesson(courseId, lessonId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['learner'] });
      toast.success(`Lesson complete · ${result.course_progress}% of the course done`);
    },
    onError: (err: Error) => toast.error('Could not save progress', { description: err.message }),
  });

  const items = lessons.data?.lessons ?? [];
  const current = items.find((l) => l.id === currentId) ?? items[0];
  const currentIndex = current ? items.indexOf(current) : -1;

  if (lessons.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (lessons.isError) {
    return (
      <div>
        <p className="text-sm text-destructive">
          Could not open this course. {(lessons.error as Error).message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/learner/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  const percent = progress.data?.progress_percentage ?? 0;
  const finished = progress.data?.status === 'completed';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="h-2 w-full max-w-md overflow-hidden rounded bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Course progress"
          >
            <div className="h-full rounded bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {percent}% complete · {progress.data?.lessons_completed ?? 0} of{' '}
            {progress.data?.total_lessons ?? items.length} lessons
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/learner/courses">Exit Course</Link>
        </Button>
      </div>

      {finished && (
        <p className="mb-6 rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          Course Complete ✅ — revisit any lesson below as a refresher.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-md border p-2">
          <ol className="space-y-1">
            {items.map((lesson, index) => {
              const done = lesson.completed_at !== null;
              // Sequential unlock: the next lesson opens once the previous is done.
              const locked = index > 0 && items[index - 1].completed_at === null && !done;

              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setCurrentId(lesson.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                      current?.id === lesson.id ? 'bg-accent font-medium' : 'hover:bg-muted',
                      locked && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4 shrink-0 text-success" />
                    ) : locked ? (
                      <Lock className="h-4 w-4 shrink-0" />
                    ) : (
                      <span className="w-4 shrink-0 text-center text-xs">{index + 1}</span>
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div>
          {current ? (
            <>
              <CoursePlayer
                lesson={current}
                completing={complete.isPending}
                onComplete={() => complete.mutate(current.id)}
              />

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  disabled={currentIndex <= 0}
                  onClick={() => setCurrentId(items[currentIndex - 1].id)}
                >
                  Previous Lesson
                </Button>
                <Button
                  disabled={currentIndex >= items.length - 1}
                  onClick={() => setCurrentId(items[currentIndex + 1].id)}
                >
                  Next Lesson
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This course has no content yet. Check back soon.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
