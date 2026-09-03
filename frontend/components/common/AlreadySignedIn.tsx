'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Clerk refuses to start any sign-in or sign-up flow while a session is live.
 * The error it throws ("You're already signed in.") lands as red text under a
 * form the reader cannot use and cannot get past, so every auth page renders
 * this instead of the form.
 */
export function AlreadySignedIn({
  description,
  signOutLabel = 'Sign out and continue',
}: {
  description: string;
  signOutLabel?: string;
}) {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>You are already signed in</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Come back to this same URL, signed out, so the flow can start over.
            A login ticket lives in the query string and has to survive. */}
        <Button className="w-full" onClick={() => signOut({ redirectUrl: window.location.href })}>
          {signOutLabel}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>
          Stay signed in
        </Button>
      </CardContent>
    </Card>
  );
}
