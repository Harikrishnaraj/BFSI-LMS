'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PublishCourseModal } from './PublishCourseModal';
import { ArchiveCourseModal } from './ArchiveCourseModal';
import { useCourseApi } from '@/lib/course-api';
import type { CourseSummary } from '@/types/admin';

/**
 * Publish and archive behave identically wherever they are triggered from, so
 * both the dashboard table and the course editor share this hook.
 */
export const useCourseLifecycle = () => {
  const api = useCourseApi();
  const queryClient = useQueryClient();

  const [publishing, setPublishing] = useState<CourseSummary | null>(null);
  const [archiving, setArchiving] = useState<CourseSummary | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['course'] });
    queryClient.invalidateQueries({ queryKey: ['instructor'] });
  };

  const publish = useMutation({
    mutationFn: (id: string) => api.publish(id),
    onSuccess: (course) => {
      invalidate();
      setPublishing(null);
      toast.success(`Published “${course.title}”`);
    },
    onError: (err: Error) => toast.error('Could not publish', { description: err.message }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.archive(id),
    onSuccess: (course) => {
      invalidate();
      setArchiving(null);
      toast.success(`Archived “${course.title}”`);
    },
    onError: (err: Error) => toast.error('Could not archive', { description: err.message }),
  });

  const modals = (
    <>
      <PublishCourseModal
        courseId={publishing?.id ?? null}
        submitting={publish.isPending}
        onClose={() => setPublishing(null)}
        onConfirm={() => publishing && publish.mutate(publishing.id)}
      />
      <ArchiveCourseModal
        open={archiving !== null}
        title={archiving?.title}
        submitting={archive.isPending}
        onClose={() => setArchiving(null)}
        onConfirm={() => archiving && archive.mutate(archiving.id)}
      />
    </>
  );

  return { setPublishing, setArchiving, modals };
};
