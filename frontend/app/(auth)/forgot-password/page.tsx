'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useSignIn } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlreadySignedIn } from '@/components/common/AlreadySignedIn';
import { clerkMessage } from '@/lib/clerk-errors';

export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setPending(true);
    setError(null);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setSent(true);
    } catch (err) {
      setError(clerkMessage(err) ?? 'Could not send a reset code.');
    } finally {
      setPending(false);
    }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setPending(true);
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        setError('Password reset needs another step. Contact your administrator.');
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
        description="Resetting a password means signing out first. If it is this account, you can change the password from your profile instead."
        signOutLabel="Sign out and reset a password"
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          {sent ? `Enter the code we sent to ${email}.` : 'We will email you a reset code.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={sent ? onReset : onSendCode} className="space-y-4">
          {sent ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Reset code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
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
            </>
          ) : (
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
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!isLoaded || pending}>
            {pending ? 'Working…' : sent ? 'Set new password' : 'Send reset code'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
