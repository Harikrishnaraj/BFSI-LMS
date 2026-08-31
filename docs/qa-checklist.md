# QA checklist

What has and hasn't been proven, and the order worth testing in. Everything
below is written from the state of `main` plus the open PRs.

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
```

## What is already proven

Don't spend QA time here unless something looks wrong.

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

### 1. Role propagation on first sign-in — test this first

The most likely thing to look broken.

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

### 2. Authenticated API access

No signed-in HTTP request has ever reached the API. Every test injects `req.user`
directly, so the Clerk middleware's claim handling is entirely unexercised.

- [ ] Admin endpoints return data, not 403, for an admin session
- [ ] A learner session gets **403** from `/api/admin/*`
- [ ] A learner gets **404** (not 403) for a draft course they cannot see
- [ ] An instructor can only edit their own courses

### 3. The three dashboards with real data

They have been type-checked and built, never rendered against an API.

- [ ] Admin: metrics, compliance table, pie chart, user CRUD, audit log viewer,
      CSV export and its download
- [ ] Instructor: metrics, course list tabs, course editor, content reorder,
      publish and archive modals
- [ ] Learner: dashboard, browse and enrol, the learn view, lesson completion,
      certificates page
- [ ] Loading skeletons and error states — pull the backend down mid-session
- [ ] Dark mode and mobile widths

### 4. SCORM end to end

Manifest and xAPI parsing are unit-tested. Nothing else in the SCORM path has
executed.

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
- [ ] Merge PR #6 (Redis cache tests) and PR #7 (Clerk checker and docs)
- [ ] Decide on `password_hash`: it is `NOT NULL` with a `clerk-managed`
      sentinel for Clerk users. Nullable is cleaner if local password login is
      never coming.
