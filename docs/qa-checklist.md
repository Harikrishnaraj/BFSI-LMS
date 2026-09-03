# QA checklist

What has and hasn't been proven, and the order worth testing in. Current as of
the browser QA passes on 1 and 2 September; everything described here is merged
to `main`.

The short version: the API logic is well covered by tests, and the **integration
seams are where the bugs have actually been** — token claims, CORS, auth headers
on downloads, data shapes between API and UI, and anything only a browser
exercises. Nine real bugs have come out of this checklist so far, and the test
suite was green through every one of them.

## Local environment

None of this is obvious from the repo, so it's written down.

| Thing | Where |
| --- | --- |
| Postgres | **port 5433** (v18). The 5432 instance is v16 and has different credentials. |
| Database | `inquiry_lms`, migrated, seeded with 3 users and 3 courses |
| Seed password | `ChangeMe!123` |
| Redis | Windows service on 6379 — Microsoft archive port 3.0.504, local dev only |
| Clerk | instance `touched-stingray-9638`; keys in `backend/.env` and `frontend/.env.local` |
| GitHub CLI | installed but not on PATH: `"/c/Program Files/GitHub CLI/gh.exe"` |

```bash
npm run dev                              # both servers
npm test                                 # 54 tests, needs Postgres + Redis for the last 8
npm run check:clerk --workspace backend  # verifies Clerk config, prints no secrets
npm run prisma:seed --workspace backend  # re-seed
npm run qa:e2e --workspace backend       # 33 authenticated end-to-end checks
                                         # (needs both servers running + real Clerk keys)
npm run signin:link --workspace backend -- admin   # ticket link for browser QA
```

If a dashboard looks unstyled or a button does nothing **in development only**,
suspect the dev server before the code: switching branches invalidates `.next`,
and a file exporting both a component and a plain value breaks Fast Refresh for
every importer, leaving the page unhydrated. `rm -rf frontend/.next` and restart.

## What is already proven

Don't spend QA time here unless something looks wrong.

- **The authenticated path, end to end** (`npm run qa:e2e --workspace backend`).
  33 checks against a running server using real Clerk session tokens minted
  through the backend API: the authorisation matrix for admin and learner, the
  course lifecycle, SCORM upload → publish → enrol → launch → xAPI → progress,
  and the resulting audit trail.

- Validation, authorisation and response shapes across admin, course, SCORM and
  progress endpoints — 46 unit tests.
- Real database behaviour: course create → publish refusal → content → publish →
  enrol → duplicate-enrol rejection → lesson completion to 100% → time-tracking
  clamp → audit trail contents — 6 integration tests against Postgres.
- Redis caching: metrics cache hit, 5-minute TTL, list invalidation — 2 tests.
- Every endpoint returns 401 to an anonymous caller.
- Both apps build; lint and typecheck clean.

## What has never run

This is the real QA surface.

### 1. Role propagation on first sign-in — DONE, was broken

Fixed on 1 September. A Clerk user arrives in two shapes — webhooks send
snake_case, `clerkClient.users.getUser()` returns camelCase — and the sync only
read snake_case, so `/api/auth/me` threw 422 for everyone and nobody was ever
provisioned. Both accounts now sync, promote their role, and write an audit row.

Re-test if the sign-up flow changes:

- [ ] Sign up at `/signup` choosing **Admin**
- [ ] Note which dashboard you land on. The session token's `role` claim reads
      `publicMetadata`, which is empty until the sync runs — and the sync runs on
      that page load. Landing on the learner view first is expected.
- [ ] Refresh after a few seconds. Do you get the admin view?
- [ ] Check `users` for the row and its `role`
- [ ] Check the Clerk dashboard: did `publicMetadata.role` get promoted?
- [ ] Repeat for **Instructor** and **Learner**

If the role never promotes, the causes to check in order: the session token claim
(`{ "role": "{{user.public_metadata.role}}" }`) is missing from the Clerk
dashboard; or `promoteRoleToPublicMetadata` failed and logged.

### 2. Authenticated API access — DONE

Covered by `npm run qa:e2e`. The session token claim is configured, so tokens
now carry `role`, and the middleware resolves it correctly for admin and
learner.

- [x] Admin endpoints return data, not 403, for an admin session
- [x] A learner session gets **403** from `/api/admin/*`
- [x] A learner gets **404** (not 403) for a draft course they cannot see
- [x] An instructor can only edit their own courses — confirmed by calling
      DELETE on another instructor's course with a real token: 403. The UI used
      to offer that action; it no longer lists those courses.

### 3. The dashboards in a browser — admin and learner DONE, instructor blocked

Two browser passes so far (1 and 2 September) have found **six** bugs between
them, none of which 54 passing tests, a clean typecheck and a successful build
could catch. Details in PRs #8, #9 and #11.

Signing in without a password: `npm run signin:link --workspace backend -- admin`
mints a 10-minute Clerk ticket link. Sign out first — a ticket is refused while
a session exists.

- [x] Admin: metrics, compliance table, pie chart, user list, live search, audit
      log viewer
- [x] Admin: user create (with validation), edit (email locked), deactivate, and
      the CSV export **including its download** — every one of those mutations
      also appeared in the audit trail, checked in the viewer afterwards
- [x] Instructor authoring, tested as an admin: course cards with per-status
      actions, the publish checklist blocking a contentless draft and going green
      once a lesson exists, the Add Content modal, and the post-publish lock
      removing the reorder and delete controls
- [x] `/instructor` dashboard — tested 2 September with a real instructor
      account. Signing up as Instructor promoted the role and created the users
      row on first load, routing landed on `/instructor`, and creating a course
      moved the metric and listed it with the right actions. Found the "My
      Courses" bug below.
- [x] Learner: dashboard, browse, enrol, learn view, lesson completion,
      sequential unlock
- [x] Learner: certificates page — all three states (active, expiring soon,
      expired) and the filter tabs, using certificates inserted by hand, since
      nothing issues them yet. Download is correctly disabled.
- [x] Loading skeletons and error states — with the backend stopped mid-session
      the shell still renders, metric cards fall back to placeholders, a red
      banner offers Retry, and Retry recovers once the API is back
- [x] Dark mode — was entirely broken, now works via OS setting
- [x] Mobile widths — no navigation existed at all below `md`; there is now

Fixed during that pass:

1. **No CORS on the API.** Every client-side call was blocked. Tests call the API
   directly and Next's server components call it server-side, so nothing ever
   sent a browser `Origin`.
2. **Role drift.** `/api/auth/me` only synced a missing row, so a role changed in
   Clerk never reached the database — producing an Admin Dashboard inside an
   INSTRUCTOR shell.
3. **The pie chart drew nothing.** Recharts 3 builds sector paths during the
   entry animation; no animation frame meant an empty `<g>` with correct data
   behind it.
4. **The dark palette never shipped.** Tailwind drops class rules in `@layer base`
   when the class never appears in content, and no toggle exists.
5. **Course descriptions were title-cased.** A `capitalize` class meant for the
   difficulty enum was applied to every field in the course detail list.
6. **Report downloads never worked.** The endpoint requires a Bearer token, and
   the UI opened it with `window.open`, which sends no Authorization header — so
   the report generated and then 401'd on retrieval. It now fetches with the
   token and saves the blob.
7. **"My Courses" listed courses the instructor did not own.** The metric said 0
   while the table showed four, because the plain course list also returns every
   published course. Edit and Archive were offered on them, and the API refused
   with 403 — correctly. The lists now pass `?mine=true`.

Fixed since, from code only — **none of these four has been re-tested in a
browser yet**:

8. **An invitation link dead-ended when someone was already signed in.** Clerk
   refuses a ticket exchange while a session is live, and `/login` had no way
   out of that. It now offers "Sign out and use this link", which signs out and
   reloads with the ticket still in the URL so the exchange runs against a clean
   session.
9. **"1 users".** A `plural()` helper in `frontend/lib/utils.ts`, applied at all
   five count strings that had the bug — users, audit entries, courses, content
   items and lessons.
10. **Deactivation used a native `window.confirm`.** `ArchiveCourseModal` was
    generalised into `components/common/ConfirmDialog`; archive and deactivate
    now share it, so there is one styled confirmation and no native dialog left.
11. **"Failed to fetch" reached users.** `fetch` rejects only when a request
    never got an answer — offline, DNS, CORS, server down — and that raw
    `TypeError` message was going straight into the toast. `apiFetch` now
    converts it to "Could not reach the server…", which fixes all ~20 error
    toasts at once. `downloadReport` does its own `fetch`, so it got the same
    treatment.

Re-test these in the next browser pass:

- [ ] Deactivate a user — styled dialog appears, Cancel is a no-op, Confirm
      deactivates and the dialog closes
- [ ] Filter user management down to exactly one match — reads "1 user"
- [ ] Stop the backend, then trigger a mutation — the toast says "Could not
      reach the server", not "Failed to fetch"
- [ ] Follow a `signin:link` ticket while already signed in — the switch-account
      button signs out and completes the sign-in

### 4. SCORM end to end — DONE for a synthetic package

`qa:e2e` builds a valid SCORM 1.2 package, uploads it, launches it, posts an
xAPI statement and checks that score, completion, time and course progress all
land. Traversal defence verified with percent-encoded and backslash payloads —
note a raw `../` never reaches the server, since fetch normalises it away, so
testing traversal with one proves nothing.

Still worth doing with a **real authored package** (Articulate, Captivate, iSpring),
which is far messier than a synthetic one:

- [ ] Upload a real `.zip` package as an instructor
- [ ] It extracts, and the manifest fields look right
- [ ] Launch returns a URL that actually loads in the iframe
- [ ] xAPI statements from the package reach `/track` and update `scorm_tracking`
- [ ] Completion promotes the lesson and moves course progress
- [ ] An expired or wrong token is refused

### 5. Webhooks

Never configured, so only the `/api/auth/me` fallback has run.

- [ ] Point a tunnel at `/api/webhooks/clerk` (see `docs/clerk-setup.md`)
- [ ] `user.created`, `user.updated`, `user.deleted` all sync
- [ ] A forged/unsigned payload is rejected with 400

### 6. Edge cases worth deliberately provoking

- [ ] Close the browser mid-course — is time still recorded?
- [ ] Resume a course — does time continue rather than reset?
- [ ] Complete a course, then keep going — completion message, no regression to
      "in progress"
- [ ] Archive a course a learner is enrolled in — they keep access, new
      enrolments blocked
- [ ] Two admins editing the same user at once
- [ ] Pagination past the last page
- [ ] A 200+ item `?limit=` (should clamp to 200)

## Known gaps — missing features, not bugs

Don't raise these as defects.

- **Assessments** — no model at all. `assessments: []` in the course detail
  response is hardcoded, and the publish checklist's assessment row is always
  unchecked (it's optional, so it never blocks).
- **Certificate PDFs** — no renderer, so the download button is disabled.
- **Export formats** — CSV only; PDF and Excel return 400 and are disabled in the
  UI.
- **File uploads** — content is referenced by URL. Direct upload needs object
  storage and signed URLs.
- **SCORM Cloud** — not integrated; packages are served locally.
  `SCORM_PLAYER_BASE_URL` is the seam.
- **Reports on local disk** — needs object storage before running more than one
  API instance.
- **Docker images** — never built. Docker isn't installed on the dev machine.
- **Deploy workflow** — never run; no registry or Railway credentials.
- **Progress weighting** — currently lessons only. The 70/30 lesson/assessment
  split waits on assessments existing.

## Housekeeping

- [ ] Rotate the Clerk secret key — the current one was pasted into a chat
- [x] Merge PR #6 (Redis cache tests) and PR #7 (Clerk checker and docs)
- [ ] Decide on `password_hash`: it is `NOT NULL` with a `clerk-managed`
      sentinel for Clerk users. Nullable is cleaner if local password login is
      never coming.
