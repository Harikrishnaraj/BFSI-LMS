'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from './StatusBadge';
import { CourseForm, type CourseFormValues } from './CourseForm';
import { ContentList } from './ContentList';
import { AddContentModal } from './AddContentModal';
import { useCourseLifecycle } from './CourseActions';
import { useCourseApi } from '@/lib/course-api';
import type { CourseContentItem } from '@/types/admin';

export function CourseEditor({ courseId }: { courseId: string }) {
  const api = useCourseApi();
  const queryClient = useQueryClient();
  const { setPublishing, setArchiving, modals } = useCourseLifecycle();

  const [editing, setEditing] = useState(false);
  const [addingContent, setAddingContent] = useState(false);

  const course = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get(courseId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const update = useMutation({
    mutationFn: (values: CourseFormValues) =>
      api.update(courseId, { ...values, targetAudience: values.targetAudience.join(', ') }),
    onSuccess: () => {
      refresh();
      setEditing(false);
      toast.success('Course saved');
    },
    onError: (err: Error) => toast.error('Could not save', { description: err.message }),
  });

  const addContent = useMutation({
    mutationFn: (values: Parameters<typeof api.addContent>[1]) => api.addContent(courseId, values),
    onSuccess: () => {
      refresh();
      setAddingContent(false);
      toast.success('Content added');
    },
    onError: (err: Error) => toast.error('Could not add content', { description: err.message }),
  });

  const deleteContent = useMutation({
    mutationFn: (item: CourseContentItem) => api.deleteContent(courseId, item.id),
    onSuccess: () => {
      refresh();
      toast.success('Content removed');
    },
    onError: (err: Error) => toast.error('Could not remove content', { description: err.message }),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => api.reorderContent(courseId, order),
    onSuccess: refresh,
    onError: (err: Error) => toast.error('Could not reorder', { description: err.message }),
  });

  if (course.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (course.isError || !course.data) {
    return (
      <div>
        <p className="text-sm text-destructive">
          Could not load this course. {(course.error as Error)?.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/instructor/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  const data = course.data;
  // Only drafts are editable; published courses must be archived first.
  const editable = data.status === 'draft';

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Last modified {new Date(data.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.status === 'draft' && (
            <Button onClick={() => setPublishing(data)}>Publish</Button>
          )}
          {data.status !== 'archived' && (
            <Button variant="outline" onClick={() => setArchiving(data)}>
              Archive
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/instructor/courses">Back</Link>
          </Button>
        </div>
      </div>

      {!editable && (
        <p className="mb-6 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          This course is {data.status} and cannot be edited. Archive it to make changes.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Course details</CardTitle>
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Category" value={data.category} />
              <Detail label="Difficulty" value={data.difficulty} />
              <Detail label="Compliance type" value={data.complianceType} />
              <Detail label="Target audience" value={data.targetAudience} />
              <Detail label="Mandatory" value={data.isMandatory ? 'Yes' : 'No'} />
              <Detail label="Enrolled" value={String(data._count.enrollments)} />
              <Detail label="Description" value={data.description} className="sm:col-span-2" />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course content</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentList
              items={data.content}
              editable={editable}
              busy={reorder.isPending || deleteContent.isPending}
              onAdd={() => setAddingContent(true)}
              onDelete={(item) => deleteContent.mutate(item)}
              onReorder={(order) => reorder.mutate(order)}
            />
          </CardContent>
        </Card>
      </div>

      <CourseForm
        open={editing}
        course={data}
        submitting={update.isPending}
        onClose={() => setEditing(false)}
        onSubmit={(values, publish) => {
          update.mutate(values, {
            onSuccess: () => publish && setPublishing(data),
          });
        }}
      />

      <AddContentModal
        open={addingContent}
        submitting={addContent.isPending}
        onClose={() => setAddingContent(false)}
        onSubmit={(values) => addContent.mutate(values)}
      />

      {modals}
    </>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value || '—'}</dd>
    </div>
  );
}
