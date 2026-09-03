'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useSignUp } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlreadySignedIn } from '@/components/common/AlreadySignedIn';
import { clerkMessage } from '@/lib/clerk-errors';
import { ROLES, type Role } from '@/types';

export default function SignupPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('learner');
  const [code, setCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setPending(true);
    setError(null);
    try {
      const [firstName, ...rest] = name.trim().split(' ');
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName: rest.join(' ') || undefined,
        // The client may only write unsafeMetadata. The backend promotes this
        // to publicMetadata on the user.created webhook, which is what the
        // session token's role claim and the users.role column read from.
        unsafeMetadata: { role },
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setAwaitingCode(true);
    } catch (err) {
      setError(clerkMessage(err) ?? 'Could not create your account.');
    } finally {
      setPending(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setPending(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        setError('That code did not complete signup. Request a new one.');
      }
    } catch (err) {
      setError(clerkMessage(err) ?? 'That code was not accepted.');
    } finally {
      setPending(false);
    }
  };

  if (authLoaded && isSignedIn) {
    return (
      <AlreadySignedIn
        description="Creating a new account means signing out of this one first."
        signOutLabel="Sign out and create an account"
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{awaitingCode ? 'Check your email' : 'Create account'}</CardTitle>
        <CardDescription>
          {awaitingCode
            ? `We sent a verification code to ${email}.`
            : 'Your administrator can change your role later.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {awaitingCode ? (
          <form onSubmit={onVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Verifying…' : 'Verify email'}
            </Button>
          </form>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div id="clerk-captcha" />

            <Button type="submit" className="w-full" disabled={!isLoaded || pending}>
              {pending ? 'Creating…' : 'Create account'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
