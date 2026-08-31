'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLearnerApi } from '@/lib/learner-api';

interface ScormPlayerProps {
  scormId: string;
  onComplete: () => void;
}

/**
 * Hosts the package in an iframe and relays xAPI statements to the API.
 *
 * The package posts statements to its parent window. Statements are accepted
 * only from this iframe's own window, so another tab or an embedded ad frame
 * cannot report a completion on the learner's behalf.
 */
export function ScormPlayer({ scormId, onComplete }: ScormPlayerProps) {
  const api = useLearnerApi();
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<string>('incomplete');

  const launch = useQuery({
    queryKey: ['scorm', scormId, 'launch'],
    queryFn: () => api.scormLaunch(scormId),
    // A launch mints a session token; don't re-mint on every focus.
    staleTime: Infinity,
    retry: false,
  });

  const track = useMutation({
    mutationFn: ({ statement, enrollmentId }: { statement: unknown; enrollmentId: string }) =>
      api.scormTrack(scormId, statement, enrollmentId),
    onError: (err: Error) => toast.error('Progress not saved', { description: err.message }),
  });

  useEffect(() => {
    const enrollmentId = launch.data?.enrollmentId;
    if (!enrollmentId) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;

      const data = event.data as { type?: string; statement?: Record<string, unknown> };
      if (data?.type !== 'xapi-statement' || !data.statement) return;

      track.mutate({ statement: data.statement, enrollmentId });

      const verb = String((data.statement.verb as { id?: string })?.id ?? '');
      if (verb.endsWith('/completed') || verb.endsWith('/passed')) {
        setStatus('completed');
        onComplete();
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [launch.data?.enrollmentId, onComplete, track]);

  if (launch.isPending) return <Skeleton className="h-[540px] w-full" />;

  if (launch.isError) {
    return (
      <div className="rounded-md border border-destructive p-6">
        <p className="text-sm text-destructive">
          Could not launch this package. {(launch.error as Error).message}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => launch.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <iframe
        ref={frame}
        src={launch.data?.launchUrl}
        title="SCORM content"
        className="h-[540px] w-full rounded-md border"
        // The package is third-party content: keep it off same-origin APIs.
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <p className="text-xs text-muted-foreground">
        Status: {status}
        {track.isPending && ' · saving progress…'}
      </p>
    </div>
  );
}
