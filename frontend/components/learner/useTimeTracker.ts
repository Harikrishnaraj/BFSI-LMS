'use client';

import { useEffect, useRef } from 'react';
import { useLearnerApi } from '@/lib/learner-api';

const TICK_MS = 30_000;

/**
 * Reports study time every 30 seconds while a course is open.
 *
 * Failed ticks are carried into the next one rather than dropped, so a network
 * blip does not lose the time, and closing the tab keeps whatever was already
 * acknowledged — the backend clamps each call, so a long carry can't book hours.
 */
export const useTimeTracker = (courseId: string, active: boolean) => {
  const api = useLearnerApi();
  const pending = useRef(0);
  // useLearnerApi returns a fresh object each render; holding it in a ref keeps
  // the effect from tearing down and restarting the interval every render,
  // which would mean the 30s tick never actually fires.
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(async () => {
      // Pause counting while the tab is hidden: it isn't study time.
      if (document.visibilityState !== 'visible') return;

      const seconds = pending.current + TICK_MS / 1000;
      pending.current = seconds;

      try {
        await apiRef.current.trackTime(courseId, seconds);
        pending.current = 0;
      } catch {
        // Keep the unsent seconds queued for the next tick.
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [courseId, active]);
};
