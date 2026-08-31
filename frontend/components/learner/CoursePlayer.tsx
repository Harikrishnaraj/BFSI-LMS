'use client';

import { Button } from '@/components/ui/button';
import { ScormPlayer } from './ScormPlayer';
import type { Lesson } from '@/types/admin';

interface CoursePlayerProps {
  lesson: Lesson;
  completing?: boolean;
  onComplete: () => void;
}

export function CoursePlayer({ lesson, completing, onComplete }: CoursePlayerProps) {
  const done = lesson.completed_at !== null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{lesson.title}</h2>
        {lesson.description && (
          <p className="mt-1 text-sm text-muted-foreground">{lesson.description}</p>
        )}
      </div>

      {lesson.type === 'video' && lesson.fileUrl && (
        <video
          src={lesson.fileUrl}
          controls
          className="w-full rounded-md border"
          // Watching to the end is the natural completion signal for video.
          onEnded={() => !done && onComplete()}
        />
      )}

      {lesson.type === 'pdf' && lesson.fileUrl && (
        <object data={lesson.fileUrl} type="application/pdf" className="h-[540px] w-full rounded-md border">
          <p className="p-4 text-sm">
            This browser cannot display the PDF inline.{' '}
            <a href={lesson.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
              Open it in a new tab
            </a>
            .
          </p>
        </object>
      )}

      {lesson.type === 'richtext' && (
        // Plain text, deliberately: rendering author-supplied HTML here would
        // be a stored-XSS hole. A sanitiser goes in when the editor produces HTML.
        <div className="prose max-w-none whitespace-pre-wrap rounded-md border p-6 text-sm">
          {lesson.contentText}
        </div>
      )}

      {/* For scorm lessons fileUrl holds the scormId returned by the upload
          endpoint, not a URL: the package is served through the API. */}
      {lesson.type === 'scorm' && lesson.fileUrl && (
        <ScormPlayer scormId={lesson.fileUrl} onComplete={onComplete} />
      )}

      {lesson.type === 'scorm' && !lesson.fileUrl && (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">
          This SCORM lesson has no package attached yet.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onComplete} disabled={done || completing}>
          {done ? 'Completed ✅' : completing ? 'Saving…' : 'Mark as complete'}
        </Button>
        {done && lesson.completed_at && (
          <span className="text-xs text-muted-foreground">
            Completed {new Date(lesson.completed_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
