# Clerk setup

Everything in the app is wired for Clerk already. What's missing is an actual
Clerk instance and its keys. This is the whole list.

Run `npm run check:clerk --workspace backend` at any point — it verifies what it
can and never prints a secret.

## 1. Create the application

1. Sign up at https://dashboard.clerk.com and create an application.
2. Enable **Email** and **Password** as sign-in options. The login, signup and
   forgot-password pages are custom and built on Clerk's `useSignIn` /
   `useSignUp` hooks, so password auth must be on or those forms have nothing
   to talk to.
3. From **API keys**, copy the publishable key (`pk_test_…`) and secret key
   (`sk_test_…`).

## 2. Paste the keys

`backend/.env`:

```
CLERK_SECRET_KEY=sk_test_…
CLERK_PUBLISHABLE_KEY=pk_test_…
```

`frontend/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
```

The publishable key **must be identical** in both files. A frontend pointed at a
different instance mints tokens the API will reject, and the failure looks like
a mysterious 401 rather than a configuration error. `check:clerk` compares them.

Both files are gitignored.

## 3. Add the role claim to the session token

**This is the step that is easy to miss and breaks authorisation silently.**

Dashboard → **Sessions** → *Customize session token* → Edit:

```json
{ "role": "{{user.public_metadata.role}}" }
```

The API reads `sessionClaims.role` to decide who is an admin. Without this
claim, every session falls back to `learner` — the least-privileged role — so
an admin signs in successfully and then sees a learner dashboard and gets 403
from every admin endpoint. Nothing errors; it just quietly under-privileges
everyone.

## 4. Wire the user-sync webhook (optional locally)

Dashboard → **Webhooks** → Add endpoint:

- URL: `https://<your-public-host>/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- Copy the signing secret into `backend/.env` as `CLERK_WEBHOOK_SIGNING_SECRET`

The webhook does two jobs: it mirrors Clerk users into the `users` table, and it
promotes the role chosen at signup from `unsafeMetadata` (all a browser may
write) into `publicMetadata`, which is what the session claim above reads.

**Locally you can skip it.** `GET /api/auth/me` provisions a missing user from
the Clerk API on first call, so signing in still works. What you lose is the
role promotion: set `publicMetadata` by hand in the dashboard for your test
users, or expose the backend with a tunnel:

```bash
npx --yes cloudflared tunnel --url http://localhost:3001
```

then point the Clerk endpoint at `https://<tunnel-host>/api/webhooks/clerk`.

## 5. Verify

```bash
npm run check:clerk --workspace backend
```

Then, with both servers running (`npm run dev`):

1. Sign up at http://localhost:3000/signup, choosing a role.
2. You should land on `/dashboard`, which routes by role.
3. Check the `users` table has a row with the right `role`.
4. `GET /api/auth/me` with the session token should return that row.

If you land on the learner dashboard when you picked admin, the role claim from
step 3 is missing or `publicMetadata.role` was never set.

## What is deliberately not automated

Creating the Clerk account and entering the keys are manual by design — they're
credentials, and they belong to you rather than to a script.
