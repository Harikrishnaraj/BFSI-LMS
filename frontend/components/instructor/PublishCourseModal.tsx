'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourseApi } from '@/lib/course-api';

interface PublishCourseModalProps {
  courseId: string | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PublishCourseModal({
  courseId,
  submitting,
  onClose,
  onConfirm,
}: PublishCourseModalProps) {
  const api = useCourseApi();

  // The server owns these rules; the modal shows the same answer it will give.
  const checks = useQuery({
    queryKey: ['course', courseId, 'publish-checks'],
    queryFn: () => api.publishChecks(courseId!),
    enabled: courseId !== null,
  });

  const ready = checks.data?.ready ?? false;

  return (
    <Dialog open={courseId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Course</DialogTitle>
          <DialogDescription>
            Published courses become visible and enrollable, and can no longer be edited.
          </DialogDescription>
        </DialogHeader>

        {checks.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : checks.isError ? (
          <p className="text-sm text-destructive">Could not load the publishing checklist.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {checks.data?.checks.map((check) => (
              <li key={check.key} className="flex items-start gap-2">
                <span aria-hidden>{check.passed ? '✅' : check.required ? '❌' : '⬜'}</span>
                <span className={!check.passed && check.required ? 'text-destructive' : undefined}>
                  {check.label}
                  {!check.required && <span className="text-muted-foreground"> (optional)</span>}
                  {!check.passed && check.required && (
                    <span className="block text-xs">Required before publishing.</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {ready && <p className="text-sm font-medium text-success">Ready to Publish</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!ready || submitting}>
            {submitting ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
