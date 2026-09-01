/**
 * Mints a Clerk sign-in link for a user with the given role, so an
 * authenticated browser session can be opened without typing a password.
 *
 *   npm run signin:link --workspace backend -- admin
 */
import { createClerkClient } from '@clerk/express';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const role = process.argv[2] ?? 'admin';
const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

async function main() {
  const { data } = await clerk.users.getUserList({ limit: 20 });
  const user = data.find((u) => (u.publicMetadata as { role?: string } | undefined)?.role === role);
  if (!user) throw new Error(`no Clerk user has publicMetadata.role === "${role}"`);

  const token = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 600,
  });

  console.log(`user:  ${user.emailAddresses[0]?.emailAddress} (${role})`);
  console.log(`link:  ${appUrl}/login?__clerk_ticket=${token.token}`);
  console.log('valid for 10 minutes, single use');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
