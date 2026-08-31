/**
 * Verifies the Clerk configuration without printing any secret.
 *
 * Run after pasting real keys into backend/.env and frontend/.env.local:
 *   npm run check:clerk --workspace backend
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClerkClient } from '@clerk/express';

const ok = (msg: string) => console.log(`  ok    ${msg}`);
const warn = (msg: string) => console.log(`  warn  ${msg}`);
const bad = (msg: string) => console.log(`  FAIL  ${msg}`);

/** Never log a key: show only enough to tell two keys apart. */
const fingerprint = (value: string) =>
  `${value.slice(0, 8)}…${value.slice(-4)} (${value.length} chars)`;

const readEnvFile = (file: string): Record<string, string> => {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) out[match[1]] = match[2];
    }
    return out;
  } catch {
    return {};
  }
};

const isPlaceholder = (value: string | undefined) =>
  !value || /^(sk|pk|whsec)_test_xxx$/.test(value) || value.includes('placeholder');

async function main() {
  let failures = 0;

  console.log('\nClerk configuration check\n');

  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  console.log('Backend keys');

  if (isPlaceholder(secretKey)) {
    bad('CLERK_SECRET_KEY is still a placeholder');
    failures++;
  } else if (!secretKey!.startsWith('sk_')) {
    bad('CLERK_SECRET_KEY does not look like a Clerk secret key (expected sk_…)');
    failures++;
  } else {
    ok(`CLERK_SECRET_KEY present ${fingerprint(secretKey!)}`);
  }

  if (isPlaceholder(publishableKey)) {
    bad('CLERK_PUBLISHABLE_KEY is still a placeholder');
    failures++;
  } else {
    ok(`CLERK_PUBLISHABLE_KEY present ${fingerprint(publishableKey!)}`);
  }

  if (isPlaceholder(webhookSecret)) {
    warn('CLERK_WEBHOOK_SIGNING_SECRET is a placeholder — user sync webhooks will 400');
  } else {
    ok('CLERK_WEBHOOK_SIGNING_SECRET present');
  }

  console.log('\nFrontend keys');

  const frontendEnv = readEnvFile(path.resolve(process.cwd(), '../frontend/.env.local'));
  const frontendPk = frontendEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (isPlaceholder(frontendPk)) {
    bad('frontend/.env.local NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is still a placeholder');
    failures++;
  } else if (frontendPk !== publishableKey) {
    // Different instances here means the frontend mints tokens the API rejects.
    bad('frontend and backend publishable keys differ — they must be the same Clerk instance');
    failures++;
  } else {
    ok('frontend publishable key matches the backend');
  }

  if (!failures) {
    console.log('\nLive API');

    try {
      const clerk = createClerkClient({ secretKey, publishableKey });
      const users = await clerk.users.getUserList({ limit: 10 });

      ok(`secret key works — Clerk reports ${users.totalCount} user(s)`);

      const withRole = users.data.filter((u) => {
        const role = (u.publicMetadata as { role?: unknown } | undefined)?.role;
        return role === 'admin' || role === 'instructor' || role === 'learner';
      });

      if (users.totalCount === 0) {
        warn('no users yet — sign up through /signup to create one');
      } else if (withRole.length === 0) {
        warn(
          'no user has publicMetadata.role set. Sign-up writes unsafeMetadata and the ' +
            'user.created webhook promotes it; without the webhook, set it by hand in the dashboard.'
        );
      } else {
        ok(`${withRole.length} of ${users.data.length} sampled user(s) have a role in publicMetadata`);
        for (const u of withRole) {
          console.log(
            `        ${u.emailAddresses[0]?.emailAddress ?? u.id} → ${(u.publicMetadata as { role: string }).role}`
          );
        }
      }
    } catch (err) {
      bad(`Clerk API rejected the secret key: ${(err as Error).message}`);
      failures++;
    }
  }

  console.log(
    '\nNot checkable from here: the session token must include the role claim.\n' +
      'Clerk dashboard → Sessions → Customize session token:\n' +
      '  { "role": "{{user.public_metadata.role}}" }\n' +
      'Without it every session falls back to the least-privileged role, learner.\n'
  );

  process.exit(failures > 0 ? 1 : 0);
}

main();
