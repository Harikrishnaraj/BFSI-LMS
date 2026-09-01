'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clerkMessage } from '@/lib/clerk-errors';

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /*
   * Clerk sends people here with a __clerk_ticket when they follow an
   * invitation or a sign-in link. Exchanging it signs them in without a
   * password; without this the link lands on an ordinary login form and the
   * ticket is silently ignored.
   */
  const ticket = searchParams.get('__clerk_ticket');
  const ticketUsed = useRef(false);

  useEffect(() => {
    if (!isLoaded || !ticket || ticketUsed.current) return;
    ticketUsed.current = true;

    (async () => {
      setPending(true);
      try {
        const result = await signIn.create({ strategy: 'ticket', ticket });
        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
          router.push('/dashboard');
        } else {
          setError('That sign-in link needs another step to complete.');
        }
      } catch (err) {
        setError(clerkMessage(err) ?? 'That sign-in link is invalid or has expired.');
      } finally {
        setPending(false);
      }
    })();
  }, [isLoaded, ticket, signIn, setActive, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setPending(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Let the dashboard index route by role rather than guessing here.
        router.push('/dashboard');
      } else {
        setError('Additional verification is required to finish signing in.');
      }
    } catch (err) {
      setError(clerkMessage(err) ?? 'Could not sign you in. Check your details and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your work email address.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Clerk mounts its bot protection here when enabled. */}
          <div id="clerk-captcha" />

          <Button type="submit" className="w-full" disabled={!isLoaded || pending}>
            {pending ? 'Signing in…' : 'Login'}
          </Button>
        </form>

        <div className="mt-6 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
          <Link href="/signup" className="text-primary hover:underline">
            Create account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

