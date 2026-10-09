# Changelog

All notable changes to `@nextsparkjs/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Upgrading

- **Run `pnpm db:migrate`: core adds `032_team_join_policies.sql`.** It changes the RLS policies of `teams`, `team_members` and `team_invitations` (idempotent). Only a project that runs the application as `nextspark_app` (the RLS cutover in `22-stability-and-support/04-postgresql-requirements.md`) sees a difference: creating a team and accepting an invitation as an existing user work there now, and a user adds a membership row only for themself (the creator of a team with no member yet, or an invitee with a pending invitation). A project route that added other users to a team on the request user's RLS connection must do it on the service connection after its own checks, as core's routes do. An invitation's team, email, role, token, inviter and expiry can no longer be changed once it is sent.
- **`pnpm db:migrate` also applies `033_team_member_roles_and_taxonomy_relations.sql`.** On the `nextspark_app` connection, a membership's role is changed by the team's owner, or by an admin for rows below admin; the owner row is changed only on the service connection (ownership transfer); members leave on their own; a membership never moves to another user or team. `entity_taxonomy_relations` rows are read and written only for entities of the caller's teams (the table named by `entityType`, with `"teamId"`, or `"userId"` for an entity without a team) and taxonomies without a team or of that team. A project whose posts entity migration was copied from an earlier template keeps it; 033 replaces its policies. A theme entity whose table name differs from its slug has its relations refused on the RLS connection. `TeamMemberService.remove(teamId, userId, actorId)` and `updateRole(teamId, userId, role, actorId)` take the acting user as a new, required last argument and run as that user (`Actor ID is required` without it); before they ran as the member, so on the `nextspark_app` connection only a member removing or changing themself worked, and core's Server Actions now pass the session user.
- **Production migrations now validate the certificate.** With `NODE_ENV=production` (in the environment or the project `.env`),
  `db:migrate`, `db:seed` and the migration verifiers connect to a URL without `sslmode` over SSL with certificate validation, as the
  application does, and no longer fall back to plain. Use `sslmode=disable` for a local server without SSL.

### Changed

- The database scripts decide SSL in one place (`scripts/db/ssl-config.mjs`). A URL without `sslmode` keeps libpq's `prefer` outside
  production; in production it uses SSL with a validated certificate, and a server without SSL stops the run with an error that names
  `sslmode=disable` and `sslmode=verify-full` and does not print the URL. Explicit `sslmode` values keep their meaning.

### Fixed

- Inviting and changing a role follow one rule: the actor must outrank the role granted (`canInviteToRole` now matches `validateRoleTransition`). An admin no longer invites another admin (`POST /api/v1/teams/:teamId/members` answers 403 `ROLE_HIERARCHY_VIOLATION`, and the `inviteMember` Server Action refuses it), and the invite dialog lists only the roles below the inviter's.
- `POST` and `PUT /api/v1/media/:id/tags` answer 404 `Tag not found` for a tag that is not a media tag of the media item's team, and change nothing. `MediaService.addTag(mediaId, tagId, userId, teamId)` and `setTags(mediaId, tagIds, userId, teamId)` take the media item's team as a new, required last argument (`Team ID is required` without it) and check every tag against it.
- The `removeMember` and `updateMemberRole` Server Actions write under the acting user's RLS context instead of the member's.
- With the application on the `nextspark_app` connection, `POST /api/v1/teams` and accepting an invitation as an existing user no longer answer 500, and the invitee can decline an invitation or have it marked expired. Accepting claims the pending invitation before adding the member, so the same invitation is not accepted twice. The invitee's email is matched without case, as the accept route does.
- Deleting an account now also deactivates the user's API keys (and drops them from the key cache) and removes the user from every team, in the same transaction as the anonymization. The audit log, login events, billing usage events and the invitations the user sent keep pointing at the anonymized user. The whole anonymization now runs on the service pool, so a deployment that runs the application as `nextspark_app` needs `DATABASE_SERVICE_URL`: without it the call fails with `User not found` and changes nothing (before, it left the sessions behind).
- The scheduled-actions processor registers the handlers of the action types core enqueues (`auth:security-notification`,
  `pattern:invalidate-cache`) itself, so the cron route and DevTools "run" execute them in any server instance, including one that
  restarted or never served the request that queued them. They no longer fail with "No handler registered". A project handler
  registered under the same name is kept. `pattern:invalidate-cache` loads the generated entity registry when it runs, so the cron route
  resolves the pages that use the pattern and revalidates them instead of skipping them as unknown entities.
- `POST /api/v1/blocks/validate` answers 400 with the API validation error shape (`code: VALIDATION_ERROR`, the issues in `details`)
  for a body that is not JSON or does not match `{ blockSlug: string, props: object }`, instead of 500.
- Migration `034_media_taxonomy_cleanup_trigger.sql`: deleting a media row removes its taxonomy relations on every database. `021`
  created that trigger only when `entity_taxonomy_relations` already existed, which on a fresh database it did not (the posts entity
  migration creates it later). 034 creates the trigger unconditionally, with a function that does nothing while the table is missing,
  and replaces the one 021 created where it exists, with the same effect.

### Documentation

- New section `22-stability-and-support` with the 1.0 stability table (stable, experimental, deprecated, deferred), the support matrix (Node.js, Next.js `~16.3.8`, pnpm, PostgreSQL 15-17, Expo SDK 54), the SemVer and deprecation policy (one minor of notice, security support for the latest 1.x minor, `latest` and `1.0.0-rc.N` on `next`, `nextspark migrate` for 12 months after 1.0.0 or the whole 1.x line, whichever ends first) and the written PostgreSQL requirements (application, service and migration roles, the `pgcrypto` extension, SSL, poolers). Neon, Supabase and Amazon RDS are listed as not verified.
- Experimental notices on the page builder dashboard editor, the media library, scheduled actions and the non-starter templates.
- The accessibility guide states WCAG 2.2 AA as the 1.0 target (axe in CI plus a keyboard and focus pass), still in progress, and no longer promises legal compliance.
- The beta.192 status page is marked historical. The README and guides no longer call the project production-ready or recommend Supabase and Vercel.

### Upgrading from 0.1.0-beta.197

- **Update with a clean git tree.** Commit your work, then `pnpm update-core --version <version>`: it stops on uncommitted changes, sets the
  `@nextsparkjs` packages to exactly that version, installs, and runs `nextspark prepare`. Next.js must already be on `~16.3.8` (16.3.8 or a later
  16.3 patch): `prepare` refuses other versions, earlier patches and other minors alike, with `NS_HOST_UNSUPPORTED_NEXT_VERSION`.
- **`pnpm build` needs a login method that can authenticate.** A project without Resend or Google credentials in `.env` or the build
  environment fails with `Production auth readiness failed`. A build that gets them only at run time declares
  `NEXTSPARK_AUTH_RUNTIME_ONLY=email,google`; placeholder values such as `re_...` are not deferred.
- **`src/proxy.ts` and `instrumentation.ts` become facades over core.** The request proxy and the server startup are now public
  entries, `@nextsparkjs/core/proxy` and `@nextsparkjs/core/instrumentation`, updated with core; the files the scaffold writes only
  re-export them. Your project still owns both files.
  - **Unchanged copies are replaced for you.** `pnpm update-core` (through `nextspark prepare`), `nextspark prepare`, `nextspark migrate`
    and the wizard replace a `src/proxy.ts`, `src/middleware.ts` or `instrumentation.ts` that is byte for byte a template an earlier
    core shipped, and print `NS_PROXY_TEMPLATE_REPLACED` / `NS_INSTRUMENTATION_TEMPLATE_REPLACED`. Commit the change.
    A copy prepare cannot write (read-only, a symlink) is left as it is with `NS_PROJECT_ENTRY_NOT_REPLACED`, and prepare goes on.
  - **Edited copies are kept**, and `prepare` and `migrate` print `NS_PROXY_FACADE_MISSING` / `NS_INSTRUMENTATION_FACADE_MISSING` with
    the content to put in their place. Replace `src/proxy.ts` with:
    ```ts
    export { proxy } from '@nextsparkjs/core/proxy'

    export const config = {
      matcher: [
        '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
      ],
    }
    ```
    and `instrumentation.ts` with `export { register } from '@nextsparkjs/core/instrumentation'`. Carry your changes over first:
    request logic of your own goes in `config/hooks/proxy.ts` (`proxyHook`, run before core's checks); paths that need a signed-in user
    go in `createProxy({ authenticatedPaths: ['/account'] })`, exported as `proxy` (it refuses paths core lets through first, such as
    `/terms`, `/api/auth` or `/api/v1`); a role check of your own, such as an area only managers may open, has no proxy option and goes in
    that page or its layout, on the server; startup code of your own goes in your `register()`,
    after `await registerNextSpark()` (`import { register as registerNextSpark } from '@nextsparkjs/core/instrumentation'`). Keep the
    `config` literal in `src/proxy.ts`: Next.js reads it from that file, not from its imports. See
    [Middleware](./docs/10-backend/06-middleware.md#extending-it).
  - **`@nextsparkjs/core/lib/middleware`, `/lib/auth/session-hint` and `/lib/docs/access` are internal now.** They were public only
    because the old template imported them. They still resolve; code of yours that imports them should use the proxy entry instead.
    `./lib/auth`, `./lib/auth/runtime-readiness`, `./lib/teams/active-team-cookie` and `./lib/scheduled-actions` stay public: the guides
    use them in project code.

- **`sel`, `cySelector` and `createAriaLabel` are no longer exported from `@nextsparkjs/core`.** Import `sel` and `cySelector` from `@nextsparkjs/core/selectors`; `createAriaLabel` comes from `@nextsparkjs/testing`. None of the three names was in the public list, and removing them after 1.0 would need a major.
- The webhook extension types `StripeWebhookExtensions` and `PolarWebhookExtensions` are now exported from `@nextsparkjs/core/lib/billing/config-types`, and the `lib/billing/*-webhook-extensions.ts` templates import them from there. The old `lib/billing/stripe-webhook` and `polar-webhook` subpaths keep working for one minor and are internal.

### Added

- Ownership transfer: `POST /api/v1/teams/:teamId/transfer-ownership` (session only), the `transferTeamOwnership` Server Action and a "Transfer ownership" entry with a confirmation in the team members list (owner only). The owner hands the team to a current member, who becomes owner while the previous owner becomes admin, in one transaction on the service connection. `TeamMemberService.transferOwnership` now runs in that transaction and throws errors with `code` `SAME_OWNER`, `NOT_OWNER` or `NOT_A_MEMBER`. An owner who wants to delete their account can now hand their teams over first.
- `@nextsparkjs/core/proxy` (`proxy`, `createProxy({ authenticatedPaths })`) and `@nextsparkjs/core/instrumentation` (`register()`): the
  request proxy and server startup the scaffold's `src/proxy.ts` and `instrumentation.ts` used to copy, as public entries.
- The [Public API](./docs/22-stability-and-support/05-public-api.md) of `@nextsparkjs/core`: the list of subpaths that follow SemVer (`public-api.json`) and the rule that makes a subpath public. A node test fails when a stable template imports a subpath that is not on the list. The exports map is unchanged; closing it is a 2.0 change.
- A CI job checks standalone output. The `standalone` job of the *Generated projects* workflow runs `scripts/deploy/verify-standalone.sh`: a starter from the packed packages, built with `output: 'standalone'`, copied without the checkout to a separate directory and served with `node server.js`, alone and behind a TLS proxy that sends `X-Forwarded-Proto: https`. It checks health, public pages, sign-in by one-time code, protected pages, writes, the write-origin rules, the Secure session cookies, the https redirect and sign-out. It runs on every push to `main`.

## [0.1.0-beta.197] - 2026-10-08

### Upgrading from 0.1.0-beta.196

- **Update the packages, after Next.js, with a clean git tree.** Commit your work first: `pnpm update-core` stops on uncommitted changes. Do the
  Next.js step below (`pnpm add next@~16.3.8`, and `pnpm add -D eslint-config-next@~16.3.8` if you have it) **before** it, and commit between
  the two, because `nextspark prepare` (the last step of `update-core`) refuses any Next.js outside `~16.3.8` (16.3.7 and earlier, 16.4 and later) with `NS_HOST_UNSUPPORTED_NEXT_VERSION`.
  Then run `pnpm update-core --version 0.1.0-beta.197`: it sets the `@nextsparkjs` packages in `package.json` (`cli`, `core`, `ui` and `testing`
  in a starter) to exactly that version, installs, and runs `prepare`. A run that stops at `prepare` leaves `package.json` and the lockfile
  modified ("Nothing was undone"): run the rollback command it prints under "To put the project back at the commit the update started from" (`git reset --hard <commit> && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile`), fix the Next.js version, and run it again.
- **Next.js 16.3.8 is the lowest supported Next.js (required).** In your project run `pnpm add next@~16.3.8` (and
  `pnpm add -D eslint-config-next@~16.3.8` if you have it), then install again; the generated host refuses 16.3.7 and earlier. This release
  of Next fixes GHSA-cjq9-62q9-8jv4 in Image Optimization.
- **Review `images.remotePatterns` in your `next.config.mjs`.** Your project owns the file and an upgrade never rewrites it. The template now
  allows `lh3.googleusercontent.com` (Google avatars) only and leaves the other hosts as commented examples. Replace any wildcard host
  (`*.public.blob.vercel-storage.com`, `*.supabase.co`, `*.cloudinary.com`) with the exact host you use, for example your Vercel Blob store's
  `<store-id>.public.blob.vercel-storage.com`, and remove the hosts you do not use.
  `allowedImageDomains` in the same file (the CSP `img-src`) is a separate list and this release left it as it was, wildcards included; narrow
  it the same way if you want the browser restricted too.
- **Queries on core's pools now fail after 60 s** (`DB_QUERY_TIMEOUT_MS`, default `60000`). Set it higher, or `0`, for long jobs
  (reports, bulk updates, scheduled actions).
- **Password sign-in in production now follows `auth.methods`.** A project on the passwordless preset (the default, no `'email-password'` in
  `auth.methods`) that still signs in with a password in production (API clients, test users, an admin given a password) adds
  `emailAndPassword: { enabled: true }` to `auth` in its `app.config.ts`; without it those requests answer `503 AUTH_METHOD_UNAVAILABLE`.
  Projects that list `'email-password'`, or declare `emailAndPassword.enabled`, are unaffected. Development is unaffected. Without the
  opt-in, invited users register with no password and sign in with an email code; a project that overrode `signup-with-invite` or the
  signup page keeps its own behaviour.
- **`pnpm build` needs a login method that can authenticate.** The production build checks it (`Production auth readiness failed`): a project
  with neither Resend nor Google credentials in `.env` or the build environment fails (the starter has none until you add them). A build that gets the credentials only at run time declares `NEXTSPARK_AUTH_RUNTIME_ONLY=email,google`
  (either or both); placeholder values such as `re_...` are values, not missing ones, and are not deferred.
- **Post categories belong to a team.** `pnpm db:migrate` applies core's `030_taxonomies_team_writes.sql`. Categories created before this release
  have no team (`taxonomies."teamId"` NULL): every team and every visitor still sees them, and only a superadmin can rename or delete them. To
  hand one to a team, set its team (review first, then run it yourself):
  ```sql
  SELECT id, slug, name FROM taxonomies WHERE type = 'post_category' AND "teamId" IS NULL;
  UPDATE taxonomies SET "teamId" = '<team id>' WHERE type = 'post_category' AND "teamId" IS NULL AND id IN ('<id>', …);
  ```
  A client of `/api/v1/post-categories` that writes, or that should see its team's categories, sends `x-team-id` (the dashboard's page builder
  does). Without it a read returns only the categories without a team.
- **`src/proxy.ts`: read the session past the cookie cache.** Your project owns `src/proxy.ts` and an upgrade never rewrites it
  (`nextspark prepare`, `build` and `migrate` warn `NS_PROXY_SESSION_CACHED` until you do this). In its
  `getSession`, add `disableCookieCache: true` to the query, as the template now does:
  ```ts
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: request.headers.get('cookie') || '' }),
    query: { disableRefresh: true, disableCookieCache: true },
  })
  ```
  Without it the proxy keeps letting a signed-out cookie pair into `/dashboard`, `/superadmin` and `/devtools` (and keeps an old role) until
  the cached `session_data` cookie expires (5 minutes by default); the pages and the API behind it already refuse.
- **Suspended accounts.** `pnpm db:migrate` applies core's `031_users_role_suspended.sql`, which adds `suspended` to the roles
  `check_users_role` accepts and keeps the others (roles your project added included). If your project replaced that constraint with
  something that is not a list of roles, the migration leaves it as it is and prints a notice: add `suspended` to it yourself. Your
  `src/proxy.ts` treats a suspended account's session as no session once it has the change above and the last line of `getSession`,
  `return session as Session | null`, is replaced with:
  `return session && (session.user as { role?: unknown }).role !== 'suspended' ? (session as Session) : null` (the API and the pages refuse
  it anyway; `NS_PROXY_SESSION_CACHED` warns until the proxy has both lines).
- **Rolling back.** Migrations 030 and 031 are not undone by downgrading the packages (`update-core` refuses to downgrade). The older
  release starts and keeps working on that database, but it does not know the `suspended` role: an account suspended on 0.1.0-beta.197 can
  sign in again on 0.1.0-beta.196. Before downgrading, restore the backup you took before `pnpm db:migrate`, or list them first
  (`SELECT id, email FROM users WHERE role = 'suspended';`). Unsuspending gives them access back, as the downgrade would; it is what the
  unsuspend action does, run it yourself: `UPDATE users SET role = 'member' WHERE role = 'suspended';`. To keep an account out, delete it or
  stay on 0.1.0-beta.197. On 0.1.0-beta.196 the superadmin suspend action succeeds on this database but is not enforced.

### Added

- `DB_QUERY_TIMEOUT_MS` (default `60000`; `0` disables): how long the client waits for an answer to a query. Works behind any pooler.
- `DB_STATEMENT_TIMEOUT_MS` (default unset): also asks the server to cancel a statement after this long. Opt-in because it travels as a
  startup parameter that transaction poolers such as PgBouncer can reject.
  A value that is not a non-negative integer is ignored with a warning.

### Changed

- **Next.js `~16.3.8`.** `nextspark init` adds `next@~16.3.8` and `eslint-config-next` `~16.3.8`; `create-nextspark-app` installs `next@16.3.8`;
  core's `next` peer, the templates, the plugins and `nextspark migrate` use `~16.3.8`. The route export table was re-checked against 16.3.8.
- **The template `next.config.mjs` lists exact image hosts only.** `images.remotePatterns` keeps `lh3.googleusercontent.com` and drops the
  wildcard hosts (`*.public.blob.vercel-storage.com`, `*.supabase.co`, `*.cloudinary.com`) and the unused `images.unsplash.com`,
  `upload.wikimedia.org` and `i.pravatar.cc`, which stay as commented examples. A project serving uploads from Vercel Blob through `next/image`
  adds its store's host (see Upgrading from 0.1.0-beta.196).
- **Better Auth's password endpoints follow `auth.methods` in production.** `auth.emailAndPassword.enabled` no longer defaults to `true`:
  left undeclared, `sign-in/email`, `sign-up/email` and the reset and change-password endpoints are on when `auth.methods` lists
  `'email-password'`, and always when `NODE_ENV` is not `production` (the dev keyring, `pnpm db:seed` users and Cypress keep signing in with
  a password). A declared `true` or `false` decides everywhere. Under the passwordless preset in production `POST /api/auth/sign-up/email` and
  `POST /api/auth/sign-in/email` answer `503 AUTH_METHOD_UNAVAILABLE` (with or without a trailing slash), `GET /api/auth/readiness` reports
  no password capability, and `POST /api/v1/auth/signup-with-invite` creates the invited account without a password (it signs in with an
  email code; a password in the request is ignored and not required); with passwords off it used to answer 503. A registration rule that
  refuses that account answers `403` with `DOMAIN_NOT_ALLOWED`, `SIGNUP_RESTRICTED` or `SIGNUP_FAILED`, and an email registered at the same
  moment `409 USER_ALREADY_EXISTS`. `isPasswordLoginEnabled(authConfig, nodeEnv?)` (`lib/auth/auth-methods`) implements the rule. The
  starter's `app.config.ts` shows the opt-in, and `06-authentication/12-passwordless-preset.md` describes it.
- **Invitation signup works without passwords.** `GET /api/auth/readiness` adds `capabilities.invitationSignup` (always `true`), and the
  signup page opened with an `inviteToken` follows it: when `invitationPasswordSignup` is `false` it shows the form without the password
  fields, sends no password, and after the account is created opens `/login` with the invited email filled in, to sign in with a code.
  Under the passwordless preset `/signup` still redirects to `/login`, except when it opens an invitation (`inviteToken` in the query).
  `useAuthReadiness` (`ClientAuthCapabilities`) now requires the new boolean and fails closed without it.
- **Publishing and unpublishing need the entity's `publish` permission.** When an entity declares a `publish` action (the starter declares
  `posts.publish` and `pages.publish` for owner and admin), creating a record with `status: "published"`, or changing a record's status into or
  out of `published`, now also needs `<entity>.publish` in the caller's team role, on top of `<entity>.create` / `<entity>.update`. Without it the
  REST API answers 403 `PERMISSION_DENIED` and nothing is written; `GenericEntityService.create` / `update` and the `createEntity` /
  `updateEntity` server actions fail with `Permission denied`. The page builder saves through the REST API and follows the same rule. Drafts,
  and edits that leave the status as it is, need only `create` / `update` as before. Entities that do not declare `publish` are unchanged.
  A create without `status` counts the field's configured `defaultValue`; with none, the INSERT and the check of the status it stored run
  in one transaction, rolled back (403, no usage counted) when the database's own default made the row published and the caller may not
  publish. An update that sets `status` carries the status it was checked against in its `WHERE`:
  if another write changed it in between, the REST API answers 409 `STATUS_CHANGED` (reload and retry) and the service fails.
- **Post categories belong to a team.** `POST /api/v1/post-categories` creates the category in the caller's team (`x-team-id`, required) and
  needs `posts.create` there; `PUT` and `DELETE` act only on a category of the caller's team and need `posts.update` / `posts.delete`, the
  same team-role permissions as the posts entity (API keys also need the `posts:write` / `posts:delete` scope, as before). A category of
  another team answers 404, and a read lists the caller's team's categories plus the ones without a team (visitors and callers without
  `x-team-id` see only the latter). Categories without a team, from earlier releases, can be changed or deleted only by a superadmin (403
  otherwise). The slug is unique per team. A post links only categories of its own team or without a team; the id of another team's category
  is ignored. Migration `030_taxonomies_team_writes.sql` says the same in the `taxonomies` RLS policies: reads as before, writes need the row's
  team, and rows without a team need `is_superadmin()` (see Upgrading). That function is wider than the API's rule: it also accepts a
  developer enrolled in the System Admin Team, so on the RLS-enforced connection (`nextspark_app`) such a developer could write a category
  without a team, while the API lets only `users.role = 'superadmin'` do it. The API is the stricter layer and the one every route goes
  through.
- **Authorization reads skip the session cookie cache.** Better Auth's cookie cache (`session.cookieCache`, 5 minutes) answered session
  lookups from the signed `session_data` cookie, so after a sign-out the cookie pair copied before it still worked for up to 5 minutes, and a
  revoked session or a changed global role (`superadmin`, `developer`) kept its old answer for as long. The API entry points
  (`authenticateRequest` in `lib/api/auth/dual-auth`, and `validateAndAuthenticateRequest`), the `/api/superadmin/*`, `/api/devtools/*` and
  `/api/user/*` routes (profile, delete-account, plan-flags), the entity, user and team server actions, the handlers of
  `generateEntityAPI` and the deprecated `entity-handler`, the `/superadmin` and `/devtools` page checks and the proxy template now read the
  session from the database (`query: { disableCookieCache: true }`; the new `getAuthorizationSession` in `lib/auth/authorization-session`
  does it for a `Headers`). That is one session query per request on those paths: the cookie cache saved it before. Reads that only display
  data (locale, the dashboard layouts) keep the cache. `nextspark prepare` and `migrate` suggest the same option in their
  `NS_PROXY_SESSION_OVER_HTTP` advice, and warn `NS_PROXY_SESSION_CACHED` for a `src/proxy.ts` that reads the session with
  `auth.api.getSession` without it.
  A project's own `src/proxy.ts`: see Upgrading.
- **The superadmin "suspend" action works.** It failed with a 500 because `users.role` did not accept `suspended`, and nothing treated
  that role as a refusal. Now `PATCH /api/superadmin/users/:id` with `suspend` sets the role `suspended`, deletes the user's sessions and
  deactivates their active API keys (`status = 'inactive'`), in one statement; the answer reports how many (`revoked`). A suspended
  account gets no new session (sign-in answers 403 `ACCOUNT_SUSPENDED`), and its session and API keys are refused wherever core reads the
  session for an authorization (`getAuthorizationSession`, `authenticateRequest`, `validateAndAuthenticateRequest`, the server actions, the
  `/superadmin` and `/devtools` checks and the proxy template) and by `validateApiKey`. `validateApiKey` reads the key owner's role on every
  request, not from its 5-minute key cache, so a suspension counts at once on every server instance (one indexed query per API-key request;
  a request now validates its key once, where the rate limiter and the route each validated it before). `unsuspend` gives a suspended user
  back the `member` role (400 if the user is not suspended); their deactivated API keys stay deactivated, they create new ones. `change-role`
  on a suspended user answers 400 and points to `unsuspend`. Nobody can act on their own account or on a superadmin, so the last superadmin
  cannot be suspended. `change-role` accepts only the roles `users.role` accepts, `member` and `developer` (only a superadmin grants `developer`); `colaborator` and `admin`, which the
  database refused, are gone from the action and from the superadmin users page. `lib/auth/suspension` exports `suspendUser`,
  `unsuspendUser` and `isSuspendedRole`.

### Fixed

- **Database pools no longer hand out dead connections and fail fast on them (#221).** With Neon, Supabase poolers or a NAT/load balancer
  between the app and the database, an idle pooled connection can be dropped silently; the next request then hung for minutes (about
  577 s observed) until `read ETIMEDOUT`, and the socket error could surface as an `uncaughtException`. Every pool core creates (the app
  pool and the service pool in `lib/db`, the Better Auth pool, the OAuth token-refresh pool and the transactional-meta pool) now comes
  from one helper, `lib/db-pool`, with:
  - a client-side query timeout (default 60 s), the mechanism that fails a query on a dead socket fast. A client whose query timed out
    is dropped, never returned to the pool: it could still be running the statement or hold an open transaction;
  - an optional server-side statement timeout;
  - TCP keep-alive (first probe after 10 s; how soon a dead peer is detected after that depends on the operating system);
  - idle connections closed after 10 s (was 30 s), well under the idle cutoffs of providers and NATs;
  - an `error` listener on every client, idle or checked out, that logs one warning line with the error code only (never the connection
    string or the message) instead of crashing the process.

  A connection that dies is dropped and the next query opens a fresh one. The transaction helpers now rethrow the original error when
  their `ROLLBACK` also fails. Nothing is retried. `max` (20) and the 10 s connect timeout are unchanged. Migrations do not use these
  pools and are not limited by them.
- **`GET /api/v1/team-invitations` with no query string lists the caller's pending invitations** (page 1, limit 20) instead of answering 500,
  and a `page`, `limit` or `status` the schema refuses is a `400 VALIDATION_ERROR`.
- **`GET /api/user/plan-flags` without `userId` answers for the signed-in user** instead of `400` ("expected string, received null").
- **The production startup check for sample-data passwords says so when it cannot run.** When its query fails, the server logs one line,
  `[auth-readiness] could not check for sample-data passwords at startup (query failed: <code>)`, with the error code or class name only,
  instead of staying silent. Startup goes on as before.

## [0.1.0-beta.196] - 2026-10-07

### Upgrading from 0.1.0-beta.195

Bump the `@nextsparkjs/*` dependencies together (`@nextsparkjs/cli` 0.1.0-beta.196 is what makes `pnpm db:seed` apply the sample data), then:

- **Sample data is no longer applied outside development, and databases that already hold it get its accounts disabled.** For every
  database, production included:
  1. Before upgrading, list the accounts that still have a sample-data password (read-only):
     ```sql
     SELECT u.id, u.email, u.role FROM users u JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential'
     WHERE a.password LIKE '22de14d5472248ed0bece911df908b2a:%' OR a.password LIKE '3db9e98e2b4d3caca97fdf2783791cbc:%';
     ```
  2. Run `pnpm db:migrate` with this release. The new core migration `029_sample_accounts_outside_development.sql` finds those accounts by
     their sample password (not by name, so a renamed one is found too) and, for each, removes that password and its sessions, deactivates
     its API keys (`status = 'inactive'`, so the audit log keeps their rows) and sets its role to `member`, which also takes it out of the
     System Admin Team. It changes nothing else and prints one line, `Sample accounts: N disabled`.
  3. If step 1 listed any account, review what it did (`login_events`, `api_audit_log`, user, team and role changes), rotate what it could
     reach (`BETTER_AUTH_SECRET`, which signs every session out, and your administrators' API keys), and delete the account if you do not
     use it. An account you still need: give it back its role and set a new password through password recovery. An account from the sample
     data that already had a password of its own is left as it is.

  A server started with `NODE_ENV=production` logs `[auth-readiness] N account(s) still have a sample-data password` while any is left.

  Development: `pnpm db:migrate` now applies no sample data (core's `090_sample_data.sql`, and every project, plugin or entity migration
  whose name contains `sample_data`/`sample-data`, that has a `-- nextspark:sample-data` line, or that inserts an account with a sample-data
  password). `pnpm db:seed` (`nextspark db:seed`), or `NEXTSPARK_SEED_SAMPLE_DATA=1` in the environment or `.env` (or `--sample-data`
  passed to core's `scripts/db/run-migrations.mjs`), applies it, and never when `NODE_ENV` is `production`.
  A tool that applies core's `.sql` files itself, outside `db:migrate`, now gets an error from `090_sample_data.sql`: leave that file out.
  Never use a database seeded for development in production (no dump, promotion or repointed `DATABASE_URL`): on it the migration above
  is recorded without disabling anything, so its sample accounts keep their password (`db:seed` prints this reminder, and a production
  server logs the warning above). To clean such a database, run the check in step 1 and remove the accounts it lists by hand (the security
  advisory has the SQL). `db:seed` relies on a session setting: behind a transaction-mode pooler (PgBouncer, Supavisor on port
  6543) it is lost and `090_sample_data.sql` fails, so point `MIGRATE_DATABASE_URL` at a direct connection.
  A development database that already has the sample users: run `pnpm db:seed` rather than `pnpm db:migrate` for this upgrade, or the
  migration above disables them (then reset the database). Cypress and CI jobs that sign in as the sample users need `pnpm db:seed` on their
  throwaway database; the `cypress-smoke.yml` template now runs it, and `cypress-regression.yml` no longer hides a failing seed.
  A project created before 0.1.0-beta.192 with the `default` theme has `migrations/090_demo_users_teams.sql` and
  `migrations/091_greek_teams_billing.sql` (moved there by `nextspark migrate`). They are sample data although their names do not say so:
  `db:migrate` recognises them by the sample accounts they insert and skips them outside development (`pnpm db:seed` applies them). The
  project keeps the files; delete them if you do not use that data, or add the line `-- nextspark:sample-data` to make it explicit.
- **`src/proxy.ts`: read the session in process (behind an HTTPS proxy every signed-in user was sent to `/login`). From 0.1.0-beta.195, or
  any earlier beta that copied the template proxy (the session check is the same since beta.190).** Your project owns
  `src/proxy.ts` and an upgrade never rewrites it, so apply the template's change by hand (`nextspark prepare`, `build` and `migrate` warn
  `NS_PROXY_SESSION_OVER_HTTP` until you do). In `src/proxy.ts`:
  1. Replace `import { betterFetch } from '@better-fetch/fetch'` with `import { auth } from '@nextsparkjs/core/lib/auth'`.
  2. Replace the `getSession` function:
     ```ts
     function getSession(request: NextRequest) {
       return betterFetch<Session>('/api/auth/get-session', {
         baseURL: `${request.nextUrl.origin}${request.nextUrl.basePath}`,
         headers: { cookie: request.headers.get('cookie') || '' },
       })
     }
     ```
     with
     ```ts
     async function getSession(request: NextRequest): Promise<Session | null> {
       const session = await auth.api.getSession({
         headers: new Headers({ cookie: request.headers.get('cookie') || '' }),
         query: { disableRefresh: true },
       })
       return session as Session | null
     }
     ```
  3. In `verifiedSession`, delete the line `.then(({ data }) => data)` after `getSession(request)` (the session comes back as is, not as `{ data }`).

  A proxy you changed elsewhere that fetches `/api/auth/get-session` needs the same change. Until you apply it, a TLS-terminating proxy
  can send `X-Forwarded-Proto: http` to the app as a workaround (the `nextspark.signed_in` hint cookie then loses `Secure`; redirects and the
  write-origin check keep using `NEXT_PUBLIC_APP_URL`). Keep `@better-fetch/fetch` in `package.json`: `@better-auth/core` requires it as a peer.

  The proxy must run on Node: Next 16's `src/proxy.ts` always does. A `middleware.ts` on the edge runtime (Next 15) cannot import
  `@nextsparkjs/core/lib/auth`, which opens database connections.

  Database connections: the proxy's copy of `lib/auth` shares the app's Better Auth pool (one per process and database URL, at most 20
  connections), so the change adds none. Measured with `next start` behind a TLS proxy, 50 concurrent `/dashboard` requests with the cookie
  cache missed: at most 41 connections to the database with this release, 40 with the old proxy (both: Better Auth's pool plus core's
  query pool, 20 each, one database URL), 62 when the proxy had a pool of its own. A pooler in front of Postgres (PgBouncer, Supavisor) needs
  no new budget for this release: keep the one each instance already had (more when `DATABASE_SERVICE_URL` differs from `DATABASE_URL`,
  which adds core's service pool).
- **Self-hosted production that stores uploads locally:** set `BLOB_READ_WRITE_TOKEN` (a Vercel Blob token, starts with `vercel_blob_`) *before*
  upgrading. From this release `POST /api/v1/media/upload` answers `503` `STORAGE_NOT_CONFIGURED` when `NODE_ENV=production` and the token is missing.
  There is no setting that keeps local storage in production. Files already under `public/uploads/temp/` keep being served and their media records
  keep pointing there; nothing migrates them.
- **Dotfiles in `public/` that answer 500** (`/brand/.gitkeep`, `/uploads/.gitignore`, `/uploads/temp/.gitkeep`), in this order: add
  `public/uploads/temp/` to your `.gitignore` (in a monorepo, `web/public/uploads/temp/`), then
  `rm -f public/brand/.gitkeep public/uploads/.gitignore public/uploads/temp/.gitkeep`. Deleting `uploads/.gitignore` first leaves development
  uploads committable.

### Security

- Sample data is no longer applied outside development, and databases that already hold it are corrected by a new core migration. See the
  security advisory published with this release, and "Upgrading from 0.1.0-beta.195" for what to check and rotate.

### Changed

- Routes that authenticate with `authenticateRequest` (`lib/api/auth/dual-auth`) now also limit each validated API key on its own, as
  `validateAndAuthenticateRequest` and `validateAndAuthenticateApiRequest` already did, on top of the per-address limit of `withRateLimitTier`.
  Several keys used from one address each get their own per-key budget. A key over its limit gets `success: false`, `error.status` 429 and
  `rateLimitResponse` (the 429, with `Retry-After`); `createAuthFailureResponse` returns it. A request authenticated more than once is counted once.
  The per-key limit is a safety cap: `DISABLE_RATE_LIMITING=true` turns off the per-address limit only, not this one. On that 429, `withRateLimitTier`
  keeps the response's own `X-RateLimit-*` headers instead of writing the per-address ones over them. `/api/mcp` answers a key over its limit with a
  JSON-RPC 429 and `Retry-After`.
- The admin and developer areas' CORS rule (`isAppOnlyCorsPath`) decodes each path segment on its own, and `corsGrant` and the write-origin check treat a
  request whose path cannot be determined like those areas. Calling `corsGrant` (`lib/api/cors-response`) without its `pathname` argument now gets the
  admin and developer areas' answer (only the app's own origins are granted): pass `requestPathname(request)`.
- **A production upload without storage no longer saves a file that is never served, and now fails.** `POST /api/v1/media/upload` with no `BLOB_READ_WRITE_TOKEN`
  wrote to `process.cwd()/public/uploads/temp` and returned a `/uploads/temp/...` URL that answered 404 until the server restarted (Next indexes
  `public/` at startup, and a container's disk is gone on redeploy). With `NODE_ENV=production` it now answers `503`, code `STORAGE_NOT_CONFIGURED`
  (`API_ERROR_CODES.STORAGE_NOT_CONFIGURED`), naming `BLOB_READ_WRITE_TOKEN`, and writes nothing; a failed Blob upload in production is a 500 instead of a
  local fallback. Development keeps the local fallback. The media library shows the message. The media docs and the self-hosting guide say that a
  self-hosted deployment needs a storage provider. No other runtime code writes under `public/`. There is no opt-out that keeps local storage in production (see Upgrading from 0.1.0-beta.195).

### Fixed

- **A new project no longer ships dotfiles in `public/`.** `public/brand/.gitkeep` and `public/uploads/.gitignore` + `public/uploads/temp/.gitkeep` were
  copied into every scaffold and answered 500 (`GET /brand/.gitkeep`, `GET /uploads/.gitignore`). The templates no longer carry them; the generated
  `.gitignore` ignores `public/uploads/temp/` instead, and the upload route creates that directory when it needs it. Projects created earlier keep their
  files (see Upgrading from 0.1.0-beta.195).
- **Behind a proxy that terminates TLS, signed-in users can open protected pages again.** The proxy template (`templates/proxy.ts`, the
  project's `src/proxy.ts`) checked the session by fetching `/api/auth/get-session` from the request's own origin. With `X-Forwarded-Proto: https`
  (nginx's usual `proxy_set_header X-Forwarded-Proto $scheme`) that origin is https on the plain-HTTP port `next start` listens on: the fetch failed
  (`Proxy error: TypeError: fetch failed … ERR_SSL_WRONG_VERSION_NUMBER` on every request) and every page under `/dashboard`, `/settings`,
  `/superadmin`, `/devtools` and private `/docs` redirected to `/login`. The API was not affected. The template now reads the session in process
  with `auth.api.getSession` from the cookie alone, so no forwarded scheme or host (`X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`) can make the
  check fail or call another host, and it no longer spends Better Auth's rolling renewal on a response that cannot carry the renewed cookie
  (`disableRefresh`, as the other render-time reads do). Redirects, `basePath`, the role checks and the `nextspark.signed_in` hint are unchanged.
  `lib/auth` keeps one Better Auth pool per process and database URL (`Symbol.for('nextspark.auth.pools')`), so the proxy's copy of the module
  does not open a second pool. Existing projects: see Upgrading.
- **A public entity page is no longer served after it is deleted, unpublished or edited.** The cached read of the public item page
  (`entity:<entity>` / `public-item:<entity>:<slug>` tags, and the ISR route) was never expired by a write, so a deleted page kept answering with its old
  content (for up to an hour), and a slug visited before it was created kept answering "not found". Every write of an entity with `access.basePath` now
  expires its public pages at once: the REST API (create, update, delete), the page builder, the server actions, `GenericEntityService` (including
  `deleteMany`), through the `afterEntity*` hooks and `expirePublicEntity` (`lib/cache/public-entity-cache.ts`). Editing a pattern expires the `patterns`
  tag. Already in beta.194; not a regression of beta.195.
- **A production build of a fresh project no longer prints `MISSING_MESSAGE` or `ReferenceError: location is not defined`.** A starter build printed 132 of the
  first and 2 of the second (blog, crm and productivity printed 48 and 2) while still passing.
  - Core's `features` messages (`analytics`, `webhooks`, `automation`) were never registered in `src/messages/<locale>/index.ts`, and `webhooks` / `automation` had no
    text, so the `/dashboard/features/*` pages asked for keys that did not exist. They are registered and written for the six locales; the empty `analytics` placeholders now have text.
  - The starter's `/dashboard/analytics` client components read the `analytics` namespace, which the dashboard route group does not send to the browser. The starter now has
    `templates/dashboard/analytics/layout.tsx`, the documented project-owned extension (`selectMessages(messages, 'dashboard', ['analytics'])`).
  - `/dashboard/settings/password` called `router.push` while rendering, which reads `location` on the server. The redirects run in an effect now, and the error status text
    uses `common.status.error` (it asked `settings` for `common.status.error`).
  - The password page no longer sends a signed-in user to `/login` while the session loads: it shows the spinner, and without a session the dashboard layout does the redirect.
  - `/devtools`, `/devtools/config`, `/devtools/tests` and `/devtools/scheduled-actions` read core's `devtools` messages instead of the starter-only `dev` ones, so blog, crm and productivity no longer show raw keys there.
- New check `tests/node/template-message-keys.test.ts`: every literal translation key used by core routes (all six locales, over the English fallback) and by each template's components, templates, blocks and lib exists in the
  messages the build merges.
- **Every translation key the core components ask for exists.** 18 literal keys in `src/components` were missing from the `en` catalog (`teams.*`,
  `billing.changePlan.confirming`, `home.auth.*`, `navigation.navigation.dashboard`, `common.soon` / `common.comingSoon`, `docs.sidebar.close`,
  `settings.billing.invoices.pagination.page`) and showed up as `MISSING_MESSAGE` the first time the component rendered. The text is added in the six locales (the
  fr/de/it/pt catalogs also get the whole `billing.changePlan` block they never had), and five components that asked for a wrong key now ask for the one that exists
  (`teams.actions.create` / `actions.invite` / `errors.permissionDenied`, `invitations.cancelSuccess`, `navigation.dashboard`). `InvoicesPagination` passed
  `{from, to}` to a message that reads `{start, end}`. `teams.json` and `billing.json` repeated a key (`entity`, `fields`, `messages`, `downgrade`), so the second
  copy silently replaced the first; the shadowed copies are gone. `tests/node/template-message-keys.test.ts` now scans `src/components` in the six locales, each read over English as the runtime does (a key that exists only in `en` still passes: many `admin.builder.*` texts are English-only in fr/de/it/pt), and fails on a repeated key in any message file.
- **`POST /api/v1/teams/switch` answers 400 `INVALID_JSON` for an empty or cut-off body** (the browser aborts the request when the page navigates away) instead of a 500 with
  a stack trace in the server log.
- **`nextspark prepare` / `build` no longer warn `NS_PROXY_PROTECTED_AREA_MISSING` for a proxy that re-exports core's template** (`export { proxy } from '@nextsparkjs/core/templates/proxy'`, or
  the repository's `…/packages/core/templates/proxy` as `apps/dev` does): that proxy has the check. Only a re-export of exactly `proxy` from that specifier counts, in code (not in a
  comment); `proxy as x`, another path ending in `core/templates/proxy`, or a proxy that names neither area still gets the warning.
- **Request-path logs that printed ids, roles, emails or invitation links are gone.** Removed: `[dual-auth]` (four lines per authenticated request, with the user id), `[GenericHandler]`
  team-membership and admin-bypass lines, `[EntityPermissionLayout]`, `[Auth] Session authentication successful for user … with role …` (billing and team usage routes),
  `[PermMiddleware]` (user and team id on every permission check), `User … switched to team …`, `[Media Upload] Team context`, and the development-only `[SettingsSidebar] enabledPages`.
  The team invitation block (invitee email and the accept URL, which is a credential) and its "email failed" fallback now print only when `NODE_ENV=development`. The domain-restriction
  messages in `lib/auth.ts` log the email's domain, not the address. Operational events (Stripe/Polar webhooks, team creation, the opt-in `logOperationHook` / `auditTrailHook`) are unchanged.

### Documentation

- **Legacy ISR does not cache public item pages.** With `cacheComponents: false` the public item pages render dynamically on every request: the `revalidate`
  they export has no effect without `generateStaticParams`, which NextSpark does not emit (Next would cache not-found pages for the whole window and every
  unknown URL would add a cache file). Cache Components, the default, caches the item pages and expires them on every write. The ISR section of
  `18-page-builder/07-public-rendering.md` says so and what a project can do to cache them itself.

## [0.1.0-beta.195] - 2026-10-07

### Upgrading from 0.1.0-beta.194

Bump the `@nextsparkjs/*` dependencies, then:

- **Read and update the signed-in user at `/api/v1/users/me`.** It answers `GET` and `PATCH` for a session cookie or an API key (`users:read` / `users:write`)
  and is `/api/v1/users/:id` for the caller's own id: same fields, same checks (`role` stays a superadmin's to change). Clients that called `/users/me` got a 403
  since beta.194: nothing to change there. The route is a new core route. The documented body is
  `firstName`, `lastName`, `language` and `metas`, not `name`/`image`.
- **The write-origin check now skips only requests that present an API key.** A `POST`/`PUT`/`PATCH`/`DELETE` that carries the session cookie
  from an origin the app does not trust (or with a form-encodable body and no Origin) passes the check only when its `Authorization: Bearer`
  value or `x-api-key` is in the API-key format (`sk_live_…` / `sk_test_…`), and it then reaches the route without its session cookie: it is
  authenticated by the key, or gets 401. Other `Authorization` values are not credentials for this check. A client affected: a browser page on another origin
  that sends a non-key Bearer (for example a Better Auth session token) together with the cookie. Add that origin to the trusted origins
  (`api.cors.allowedOrigins` / `CORS_ADDITIONAL_ORIGINS`) or authenticate it with an API key. Native clients (no Origin, JSON body) and pages on
  the app's own origin are not affected; `Origin: null` keeps being refused (403 `ORIGIN_NOT_ALLOWED`).
  Code that calls `checkRequestOrigin` (`@nextsparkjs/core/lib/api/request-origin`) itself: it now returns the 403 response or the request
  to hand to the handler (never `null`); pass that request on instead of the original one.
- **`next.config.mjs`: remove the CORS block for `/api`.** Core now answers CORS on `/api` itself, per request, from `NEXT_PUBLIC_APP_URL`,
  `api.cors.allowedOrigins`, `api.cors.additionalOrigins` and `CORS_ADDITIONAL_ORIGINS` (see Changed). The `headers()` of the
  `next.config.mjs` that `create-nextspark-app` wrote applies on top of a route's own headers under `next start`, so it would keep naming
  `NEXT_PUBLIC_APP_URL` on every `/api` response and the other listed origins would get no CORS grant. New projects no longer have the block.
  `nextspark migrate` and `prepare` keep your `next.config.mjs` as it is, so delete these lines from the array `headers()` returns (keep the
  `securityHeaders` entry before them):
  ```js
      // CORS headers for API routes
      // NOTE: In development, CORS is handled dynamically by API routes using addCorsHeaders()
      // to support multiple origins (web app, mobile app, etc.)
      // In production, we set static CORS headers here
      ...(isProduction ? [{
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, x-api-key, x-verify-from-ui, Cookie, Set-Cookie'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Set-Cookie'
          }
        ]
      }] : [])
  ```
  A project created before 0.1.0-beta.95 has the same entry without the `...(isProduction ? [ … ] : [])` around it (it applied in
  development too): delete the whole `{ source: '/api/:path*', headers: [ … ] }` object that follows the `securityHeaders` entry.
  `isProduction` is still used by the CSP and HSTS above it. If your project serves its front end from another origin, list that origin in
  `api.cors.allowedOrigins.production` or `CORS_ADDITIONAL_ORIGINS`. A project that added its own `/api` headers there should not set
  `Access-Control-*` in `next.config.mjs`, for the same reason.
- **Your own API routes:** a route wrapped in `withRateLimitTier` now sends core's CORS on every response. For its preflight to match, export
  `OPTIONS` from it: `export const OPTIONS = corsPreflight` (`import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'`).
  Without it Next.js answers `OPTIONS` itself, with no CORS headers, as before. A route that does not use `withRateLimitTier` and must be
  called from another origin calls `addCorsHeaders` itself.
- **`src/proxy.ts` (optional):** core no longer reads `x-api-user-id`, `x-api-key-id` or `x-api-scopes` from requests (see Security), and the
  proxy template now also removes them from incoming requests. To do the same in an existing project, add the three names to
  `TRUSTED_IDENTITY_HEADERS` in `src/proxy.ts`.
- **Set `NEXTSPARK_CLIENT_IP_SOURCE` for your deployment (recommended).** It names where the client address comes from for rate limits,
  audit logs and security notifications: `vercel`, `cloudflare`, `xff` (with `NEXTSPARK_TRUSTED_PROXY_HOPS`, the number of proxies you
  run in front of the app), `header:<name>`, or `none` when nothing in front of the app sets one. Left unset, the order core used before
  stays and production logs a warning at startup. What to set:
  - Vercel: `NEXTSPARK_CLIENT_IP_SOURCE=vercel`.
  - Cloudflare (every request reaches the app through it): `NEXTSPARK_CLIENT_IP_SOURCE=cloudflare`.
  - nginx or another single reverse proxy that appends to `X-Forwarded-For`: `NEXTSPARK_CLIENT_IP_SOURCE=xff` and `NEXTSPARK_TRUSTED_PROXY_HOPS=1`
    (a proxy that overwrites one header instead: `NEXTSPARK_CLIENT_IP_SOURCE=header:x-real-ip`, naming that header). Let `next start` listen only where the proxy reaches it.
  - Docker (or any host) with no proxy in front: `NEXTSPARK_CLIENT_IP_SOURCE=none`. The app cannot see a client address there, so every request shares
    one rate-limit bucket per tier and audit rows record `unknown`; put a proxy in front for per-client limits.

  Each mode reads only the headers it names, so a client cannot choose its address with a header the mode does not name. More at [nextspark.dev/docs](https://nextspark.dev/docs).

Then run `pnpm exec nextspark prepare` (or just `pnpm build`). Nothing here needs `pnpm db:migrate`.

### Security

- API audit rows take the caller's identity only from authentication. `withApiLogging` writes an `api_audit_log` row only for a request the route authenticated
  with an API key, attributed to that key and its owner, and writes none otherwise; it no longer stores the request body (the entity routes' audit log likewise).
  `getApiAuth` returns the key that `validateApiKey` accepted for the request and throws when there is none. `withRateLimit` (without `Tier`) validates the presented key
  and limits by it. The `src/proxy.ts` template removes the internal identity headers from incoming requests (see Upgrading). See the security advisory published with this release.
- The write-origin check on cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests is skipped only for a request that presents an API key (`sk_live_…` / `sk_test_…`
  in `Authorization: Bearer` or `x-api-key`); such a request reaches the route without its session cookie. Other `Authorization` values are not credentials for the check. See Upgrading.
- CORS credentials only for trusted origins: an origin that is not allowed gets no `Access-Control-Allow-Origin` and no `Access-Control-Allow-Credentials`, from
  `addCorsHeaders`, `handleCorsPreflightRequest` and `wrapAuthHandlerWithCors`. With `api.cors.allowAllOrigins.development`, any origin is still echoed in development,
  with credentials only for the origins the write-origin check trusts. CORS now comes from core in every environment (see Changed). `/api/user/profile`
  reads the session from the request it handles.
- Rate limits are counted per client address, and the source of that address is a deployment setting (`NEXTSPARK_CLIENT_IP_SOURCE`, see Added and Upgrading). `withRateLimitTier` (`@nextsparkjs/core/lib/api/rate-limit`) counts requests per client address and tier for every caller. The `x-api-key`
  header no longer selects the bucket: the wrapper runs before the route has validated anything. Routes that authenticate with
  `validateAndAuthenticateRequest` or `validateAndAuthenticateApiRequest` also limit each validated API key on its own; routes that use
  `authenticateRequest` have only the per-address limit. Several API keys used from one address now share that address's limit per tier.
  `generateExternalAPI` (`lib/entities/external-api-generator`) counts per client address too, before the key check.
- The admin and developer areas answer CORS only to the app's own origin (`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`): under `/api/superadmin/*`,
  `/api/devtools/*` and `/api/v1/devtools/*`, responses, errors and preflights name no other origin, listed or not, and send no credentials header
  to it. The write-origin check applies the same rule there: a cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` is accepted only from the
  app's own origin (and, outside production, a private-network origin), and any other listed origin gets 403 `ORIGIN_NOT_ALLOWED`. Requests that
  present an API key, and native requests without `Origin`, are handled as on other routes. Same-origin requests from the app's own pages are
  unaffected. There is no option to change it: if the admin areas are opened from another domain of yours (`www.` vs the apex, a preview
  domain), that domain must be `NEXT_PUBLIC_APP_URL` or `BETTER_AUTH_URL`, not only a listed origin. #217

### Added

- **`NEXTSPARK_CLIENT_IP_SOURCE` and `NEXTSPARK_TRUSTED_PROXY_HOPS`**, and `getClientIp(headers)` in `@nextsparkjs/core/lib/api/client-ip`:
  one place that decides a request's client address, from the source the deployment names. With `vercel`, `cloudflare` or `header:<name>`,
  Better Auth's own rate limit reads the same header (`advanced.ipAddress.ipAddressHeaders`). Fixes #211.
- **`GET` and `PATCH /api/v1/users/me`** (the static `me` segment wins over `[id]`). Fixes #209.
- **`/robots.txt`** from core's route manifest (`@nextsparkjs/core/routes/robots`), so every project answers `text/plain` 200 in Cache Components and legacy
  ISR, not the public catch-all's HTML. It allows the public pages and disallows `/dashboard`, `/superadmin`, `/devtools` and `/api` (under the base path, if any).
  It declares no sitemap: core has none. Under a Next `basePath` it is served at `/<base>/robots.txt` (its rules carry the prefix), which crawlers do not read: the robots file of the host root is then the deployment's concern. Run `pnpm exec nextspark prepare` (or `pnpm build`) to generate it. To change it, add `templates/robots.ts`
  (a default export returning Next's `MetadataRoute.Robots`), which replaces core's. A project that already serves `/robots.txt` from `public/robots.txt` should
  delete that file: Next refuses a public file and a route for one path (500 in dev). Fixes #214.

### Changed

- Every reader of the client address in core and the `social-media-publisher` plugin uses `getClientIp`: `withRateLimitTier`, the auth and
  CSP report rate limits, `generateExternalAPI`, `logApiUsage`, the entity audit log and the new-device fingerprint. API and entity audit rows
  and the plugin's audit rows used the whole `X-Forwarded-For` value; with the setting unset they now record the same address the rate limit
  counts: `cf-connecting-ip`, else the last `X-Forwarded-For` entry, else `x-real-ip`, else `true-client-ip`. With the setting unset, the rate
  limit of `POST /api/auth/*` also falls back to `true-client-ip`, and the CSP report endpoint's limit uses that same order instead of the
  first `X-Forwarded-For` entry. An invalid `NEXTSPARK_CLIENT_IP_SOURCE` makes rate-limited routes answer 500 and is logged at startup in
  every environment; audit rows and the new-device fingerprint record `unknown` instead.
- CORS on `/api` comes from core in every environment, and the `next.config.mjs` template sends no `Access-Control-*` headers (existing
  projects: see Upgrading). `withRateLimitTier` adds core's CORS to every response it returns: the route's, its own 429 and the origin
  check's 403. Listed origins come from `api.cors.allowedOrigins`, `additionalOrigins`, `CORS_ADDITIONAL_ORIGINS` and `NEXT_PUBLIC_APP_URL`
  (which origins get CORS and credentials: see Security). A response that already names an origin keeps it. The `webhook` tier gets no CORS
  headers. Every core, plugin and template route wrapped in `withRateLimitTier` (webhooks excepted) exports `OPTIONS`
  (`corsPreflight`, `@nextsparkjs/core/lib/api/cors-response`), so its preflight gets the same answer; the devtools routes' preflights do too.
  The 429 of `/api/auth/*` carries the same CORS as its other responses. A front end served from another origin than the API works under
  `next start` once that origin is listed.
- The CORS preflight allows every custom header core's clients send: `x-signup-intent` and `x-verify-from-ui` join `x-team-id` and
  `x-builder-source`, so a signup with an intent or an email verification from a listed origin passes its preflight. Core's clients and the
  allowed-headers list share one constant (`@nextsparkjs/core/lib/api/client-headers`). #217
- The sign-in pages, the page titles of the auth group and of public entity pages, and the emails core sends (sign-in code, password reset,
  team invitation, email verification) use `app.name` from the project's `config/app.config.ts` instead of the fixed "Boilerplate" / "Your App".
  `NEXT_PUBLIC_APP_NAME` still wins when it is set, in the pages and in the emails alike. The name is HTML-escaped in the email bodies. A project that never set `app.name` shows core's default name, `NextSpark`. The new optional
  `app.description` is the line under the name on the sign-in card (nothing is shown without it; it used to read "Modern Full-Stack Application").
  `create-nextspark-app` now writes the wizard's name and description into `app.config.ts` for all four templates.
- `create-nextspark-app` / `nextspark init` run `pnpm install` without `--force` (the flag printed `WARN using --force I sure hope you know what
  you are doing` on pnpm 10; it was added for "cleaner installs" and nothing depends on it).
- `nextspark dev` and `nextspark build` start the project's own `next` instead of `npx next`, and the wizard runs `pnpm exec nextspark init`
  instead of `npx nextspark init`: npm 11 (Node 24) read the generated `.npmrc` and printed `npm warn Unknown project config "shamefully-hoist"`
  on every run. When Next is not installed in the project they stop with "Next.js is not installed in <dir>. Run `pnpm install`".

### Fixed

- Slugs of public entities are validated on write (#215): `POST`/`PATCH` of an entity with a `slug` field that is public (`access.public` or a base path) answers
  `400 VALIDATION_ERROR` with `details[].path: ['slug']` instead of a database constraint error, and the page builder's slug input shows the same message next to
  the input. One format, the one the starter's `valid_slug` / `valid_post_slug` constraints enforce: lowercase letters, digits and hyphens (2 to 100 characters, no leading,
  trailing or repeated hyphen). The 100-character cap is new for blog posts and categories, whose columns allow more (`VARCHAR(255)` / `VARCHAR(100)`, no CHECK). A dot is not
  allowed: the database refuses it, and a public item route reads a last segment with a file extension as a file request. Reserved words are the routes that really answer a root URL,
  not a guess list: core's top-level routes (`api`, `dashboard`, `superadmin`, `devtools`, `docs`, `login`, `signup`, `forgot-password`, `reset-password`, `verify-email`,
  `accept-invite`, `auth-error`, `403`, `public`, `_next`; a test keeps the list equal to the route manifest) and the first segment of every other registered entity's base path
  (`blog` while posts are at `/blog`). They are refused only for entities served at the site root, not below `/blog`; `home`, `v1`, `index`... are allowed. A route a project adds
  under `templates/` is the project's to avoid. An entity with `allowNestedSlugs` is validated per segment.
  Existing rows are not rewritten and **a slug that is not changing is never judged**: the builder neither checks nor sends the stored slug of a page it edits, and `PATCH` with the
  stored slug passes (the API reads the current value only when the rule fails), so a row written before this rule, or by SQL, stays editable. To find the rows that would be refused
  if their slug changed to the same value, run `SELECT id, slug FROM pages WHERE slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(slug) NOT BETWEEN 2 AND 100` (and the same for each public entity).
- **Signing out and in again in the same tab.** Signing out, and the dashboard's own redirect to `/login` when the session ends (another tab signed out,
  the session expired or was revoked), now load `/login` as a full page navigation (base path included) instead of a client navigation. With Cache
  Components the signed-in pages stayed mounted, hidden, so `/login` came back as the form the last sign-in left (code step, the used code) and the
  dashboard, shown again after the next sign-in, sent the user back to `/login` (seen in development). The client's session refresh before leaving
  stays, so there are no 401s after a sign-out. The entity detail, edit and list pages request nothing while there is no user (that was a 401 in legacy
  ISR). `signOut()` now throws when the server refuses it (a 429, a network error) instead of loading `/login` with the session still alive.
- A `config/billing.config.ts` that exists but cannot be loaded (a syntax error, a bad import, an exception while it is evaluated) now fails
  `prepare` and `build` with the file name and the underlying error (#212). It used to be swallowed and the build went on with an empty billing
  registry, and a project without plans skips every feature and quota check. A config without a `billingConfig` export with plans, features
  and limits already failed, and now says which file. A project with no billing config keeps building as before; if yours throws today, the
  build now stops until you fix it.
- web-mobile projects: the root scripts `dev:mobile`, `ios` and `android` and the README's `pnpm --filter mobile test` matched no package (the
  mobile package is named `<slug>-mobile`), so pnpm printed "No projects matched the filters" and exited 0. Every filter the generator writes is
  now a path (`--filter ./mobile`, `--filter ./web`). A project created before this keeps the broken scripts: replace `--filter mobile` with
  `--filter ./mobile` in its root `package.json`.
- web-mobile README: dropped the obsolete `npm install -g expo-cli` prerequisite (the project's own Expo CLI, `pnpm expo ...` in `mobile/` or the root scripts, needs no global install).
- `[DB] WARNING: SSL disabled in production environment` printed once per module load (about 12 times per build or start). It now prints once per
  process, and not at all when the connection string asks for `sslmode=disable` and the host is `localhost`, `127.0.0.1` or `::1` (a remote host
  still gets it; the host name is matched case-insensitively).
- **`pnpm dev` of a Cache Components project no longer reports instant-navigation issues on a fresh starter (#216).** Next.js 16.3's dev server checks every
  page of a Cache Components host for instant navigation and logged `Could not validate that a segment in your UI has instant navigation` for
  `/dashboard` and `/dashboard/tasks` (and `Could not validate instant ... the target segment from rendering` for `/[slug]`), with an issue in the dev badge; the
  pages worked. Causes and fixes, all in core (nothing to change in a project):
  - The dashboard's client auth gate (`AuthenticatedDashboardLayout`) returned a skeleton instead of the page while the session loaded, so the route's own
    segments were never rendered on the server. It now renders the page while the session loads (the shell and pages show their own loading states) and
    mounts the translation preloader and the auth-method detector only for a known user. Signed out it still renders nothing and goes to `/login`.
  - A new Cache Components variant of the main dashboard layout (`routes/dashboard/(main)/layout.cc`, picked by `nextspark prepare` when `cacheComponents` is on) renders the
    shell at once and runs the entity permission check (session and database) inside a Suspense boundary around the page. The ISR layout is unchanged and still redirects
    before rendering anything. The check moved to `routes/_internal/dashboard-main-shared`, shared by both.
  - The pages that await `params`, `searchParams` or redirect now sit behind a boundary of their own in a Cache Components host: the public item pages
    (`public-item-route.cc`), the dashboard detail and edit pages of every entity (new `entity-detail-route.cc` / `entity-edit-route.cc`, used by the generated host only with
    `cacheComponents` on), the `/signup` page, core's default home (`/`, a redirect to the dashboard when a project has no landing page: new `(public)/page.cc` variant), the public archive page and `/dashboard/permission-denied`. What a visitor gets does not change (the layouts already streamed these
    pages after their shell; an ISR host keeps its real 307 and 404).
  - New projects ship `public/favicon.ico`. Without one, the browser's own `GET /favicon.ico` was answered by the public `[slug]` page (an HTML "not found" with status 200) and
    logged the `/[slug]` message on every page load. Add the file to an existing project to stop it.
  - The public item routes (`[slug]`, `[...slug]`) answer `notFound()` at once for a request for a static file (last segment ending in `.ico`, `.png`, `.jpg`, `.svg`, `.webp`, `.txt`, `.xml`,
    `.json`, `.webmanifest`, `.map`, `.js`, `.css`, `.woff`, ...: `/favicon.ico`, `/robots.txt`): no database read and no project template run for it. A slug with a dot (`release-1.0`, `v2.5`) still renders.
  - `/superadmin` and `/devtools` open without the message too (#213). Their client guards (`SuperAdminGuard`, `DeveloperGuard`) showed a loading state on the server, so
    the area's pages were never rendered there ("dropped segment"), and each page awaited its server-side role check outside Suspense. In a Cache Components host core's area
    layouts now tell their guard the server already checked the role (new `serverChecked` prop, off by default), and every page and layout under an area checks the role
    inside a Suspense boundary of its own (`_internal/area-access.cc`, the variant's `access`). The check itself does not change: an anonymous request is still sent to
    `/login`, a session without the role to `/dashboard?error=access_denied`, and nothing of the area renders for either (the proxy's redirect still comes first). A legacy
    ISR host keeps its facades, its guards and its 307.
- **Signing out no longer makes the dashboard request `/api/user/profile` and `/api/v1/teams` and get 401.** The client's session store keeps the signed-in user until its own
  request for the session answers, and `signOut()` emptied the query cache before that: every signed-in query still on the page (teams, profile, preferences) refetched on its next
  render, and the API refused each with 401 (three red lines in the browser console). `signOut()` now brings the session store up to date first, then loads `/login` (see *Signing out and in again in the same tab*).

### Documentation

- `/api/v1/users` docs, API Explorer preset and the metadata guide's `users/me` example describe what the route accepts and returns (`metas=`, not `metadataFields=`).
- New guide `14-deployment/10-client-address.md` (which `NEXTSPARK_CLIENT_IP_SOURCE` value to set per deployment target); the authentication, rate-limiting, audit-logging and deployment pages, the page builder pages API and the mobile app docs describe the changes above.

## [0.1.0-beta.194] - 2026-10-06

### Upgrading from 0.1.0-beta.193

Bump the `@nextsparkjs/*` dependencies, then:

1. **Next 16.3.6 is the lowest supported Next.js (required).** The generated host refuses 16.3.5 and earlier: run `pnpm add next@~16.3.6` and install again.
2. **React `^19.2.0` and Node.js 22.14 or later.** Raise `react` and `react-dom` to `^19.2.0` (`pnpm add react@^19.2.0 react-dom@^19.2.0`) and run
   Node.js 22.14 or later: core, ui and testing now declare `engines.node` `>=22.14.0`.
3. **Cookie-authenticated writes check the request origin.** A browser app served from another origin than `NEXT_PUBLIC_APP_URL` /
   `BETTER_AUTH_URL` that calls the API with the session cookie (`POST`, `PUT`, `PATCH`, `DELETE`) now gets 403 `ORIGIN_NOT_ALLOWED`: add
   that origin to `CORS_ADDITIONAL_ORIGINS` (or `api.cors.additionalOrigins`). Nothing to do for the app's own pages, for API keys and bearer
   tokens, for reads, or for `@nextsparkjs/mobile` (it sends `Authorization: Bearer`). A client that sends the session cookie with a
   `text/plain`, urlencoded or multipart body and no `Origin`/`Referer` now gets 403 `ORIGIN_REQUIRED`: send JSON or an `Origin` header.
   Private-LAN origins are accepted outside production only.
4. **`/api/v1/users/:id` and `/api/v1/users/:id/meta/:key` accept only the user themselves or a superadmin.** A client that reads or updates
   another user through these routes gets 403: use the superadmin endpoints, or the team endpoints (`/api/v1/teams/:teamId/members`) for team members.
   Changing a role and deleting a user stay superadmin-only.
5. **`db:migrate` refuses a not-yet-run project migration file that has its own transaction statements.** A file with its own `BEGIN`/`COMMIT`
   (or `ROLLBACK`, `END`, `ABORT`, `START TRANSACTION`, `PREPARE TRANSACTION`) that has not run yet stops `db:migrate` before it runs: take those
   statements out, or start the file with the line `-- nextspark:no-transaction` if it has to manage its own transactions (see the last Fixed
   item). Files that already ran are skipped as before; core's, the templates' and the plugins' files have no such statements. A `DO` block or
   `CALL` that commits inside its body now fails inside that transaction (nothing stays) and needs the same marker. History tables are unchanged.
6. Nothing to do for the billing default: it only changes what `create-nextspark-app` writes into a **new** project. An existing project keeps
   its `billing` setting and its plans.
7. **pnpm 10 projects need 10.34.6 or later** (was 10.16; 10.16 fails on a warm cache with `ERR_PNPM_MISSING_TIME`); pnpm 11 and 12 are
   unchanged. With Node 22, the bundled Corepack cannot install pnpm 12: update Corepack or install pnpm standalone.

Then run `pnpm exec nextspark prepare` (or just `pnpm build`) and `pnpm db:migrate`. A project created before `0.1.0-beta.193` that lists
`<name>@<version>` entries under `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` replaces them with the package names to install a release
the day it is published (see `0.1.0-beta.193` below).

### Security

- `/api/v1/users/:id` and `/api/v1/users/:id/meta/:key` check who is asking: every handler allows only the user themselves (by id or exact email)
  or a superadmin (a superadmin API key also needs the route's scope); changing a role and deleting stay superadmin-only. The check runs before any
  lookup. See the security advisories published with this release.
- The proxy's session lookup (`/get-session`) is excluded from Better Auth's shared rate limit; sign-in, sign-up and one-time-code limits are unchanged.
- The CORS headers in `lib/entities/external-api-generator` (`generateExternalAPI`) no longer send `Access-Control-Allow-Credentials` unless the request origin is
  listed explicitly; an origin list of `['*']` gets no credentials header.
- Cookie-authenticated `POST`, `PUT`, `PATCH` and `DELETE` requests to the API routes wrapped by `withRateLimitTier` (core's `/api/v1`,
  `/api/user`, `/api/superadmin` and `/api/devtools`, and any app or plugin route that uses it) must come from a trusted origin: the app's own
  (`NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`) or one Better Auth already trusts (`api.cors.allowedOrigins` / `additionalOrigins`,
  `CORS_ADDITIONAL_ORIGINS`). The `Origin` header is checked, or the `Referer` when `Origin` is absent; anything else gets 403
  `ORIGIN_NOT_ALLOWED`. Requests with an API key or a bearer token (`Authorization: Bearer`, `x-api-key`), reads, and requests without the session
  cookie are unaffected. `@nextsparkjs/mobile` passes because it sends `Authorization: Bearer`. A cookie client with neither `Origin` nor `Referer` is
  accepted unless its body is `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`, which gets 403 `ORIGIN_REQUIRED`
  (send JSON or an `Origin` header). Private-LAN origins are accepted outside production only.
  If a browser app on another origin calls the API with the session cookie, add that origin to `api.cors.additionalOrigins` or
  `CORS_ADDITIONAL_ORIGINS`.
- The origin check counts only `Authorization: Bearer <token>` and a non-empty `x-api-key` as header credentials; other `Authorization`
  schemes (for example `Basic`) are checked like a cookie request.

### Changed

- **Supported versions for 1.0 (G0): Next `~16.3.6` (lowest supported 16.3.6, range still `~16.3.x`) and React `^19.2`.** `nextspark init` adds
  `next@~16.3.6` (was `^16.3.5`), `eslint-config-next` `~16.3.6` and `react`/`react-dom` `^19.2.0`; `create-nextspark-app` installs `next@16.3.6`;
  core's `next` peer, the templates and plugins and `nextspark migrate` use `~16.3.6` (migrate also sets `eslint-config-next` to it), and core's
  `react` and `react-dom` peers are `^19.2.0`. The plugins and the blog, crm and productivity templates take `next` `~16.3.6` as a peer (they
  accepted `^15.0.0 || ^16.0.0`). The generated host refuses Next 16.3.5: run `pnpm add next@~16.3.6` and install again. Next 15 and React 18 are
  no longer supported. Core, ui and testing declare `engines.node` `>=22.14.0`. The route export table was re-checked against 16.3.6 with no change.
- **Billing is off by default.** `create-nextspark-app -y` (the `saas` preset) and the wizard's billing prompt now default to billing `free`: no
  billing notice, no seeded plans and no plan limits, so a fresh project can create tasks. The wizard's "Billing & Subscriptions" feature is
  unchecked by default. `freemium` and `paid` stay available (billing prompt, `crm` preset) and keep the experimental notice.
- **pnpm floor for projects: 10.34.6** (was 10.16), the newest 10.x that CI tests; 11 and 12 are unchanged. pnpm 10.16 fails on a warm
  cache with `ERR_PNPM_MISSING_TIME`. With Node 22, the bundled Corepack cannot install pnpm 12: update Corepack
  (`npm install --global corepack@latest`) or install pnpm standalone. README, create README, getting started and the generated project README say so.
- The CLI marks billing, the first-party plugins, the blog/crm/productivity templates and the `add:plugin`, `add:mobile`, `setup:ai` and
  `sync:ai` helpers as experimental (the docs also mark the MCP server). `add:theme` stays unsupported and now points to `create-nextspark-app --theme`.

### Fixed

- **A web+mobile project from `create-nextspark-app` keeps the full `--name` and passes its own checks.** `--name "My App"` reached the
  wizard as `--name My App` (the wizard was spawned through a shell that does not quote), so `mobile/app.config.ts` got `name: 'My'`, and a
  description with spaces was cut the same way. The name is also escaped when written into `app.config.ts`. The mobile app ships a smoke
  test and a Jest `transformIgnorePatterns` that works under pnpm's `.pnpm/` layout, so the root `pnpm test` no longer fails on `jest`
  finding nothing to run. `react-native-worklets` is pinned to `0.5.1` and mobile's `@types/react` to `~19.1.10`, what Expo SDK 54 expects,
  so `expo-doctor` passes 18/18 (web keeps its own `@types/react`).
- **A project with no billing plans can create entities with a mapped limit.** `SubscriptionService.canPerformAction` returned `QUOTA_EXCEEDED` (429)
  for `tasks.create` when `plans` is empty, because no subscription exists; with no plans declared it now skips the feature and quota checks.
- **`nextspark migrate` from `0.1.0-beta.183`** (the oldest release it is supported from; guide: `docs/17-updates/06-upgrade-0x-projects.md`).
  An untracked `node_modules/` no longer crashes it with `spawnSync git ENOBUFS` (the untracked listing collapses directories, so a project
  without `node_modules/` in `.gitignore` gets the "dirty git tree" refusal, which now says to ignore `node_modules/` or `.next/` first). `--yes`
  adds `node_modules/` and `.next/` to `.gitignore` when missing and names only the entries it really added (it claimed `.nextspark/` when
  that was already there). A legacy `pnpm.onlyBuiltDependencies` moves into `pnpm-workspace.yaml` as `allowBuilds` and `onlyBuiltDependencies`
  (plus the packages NextSpark needs, your entries kept), so pnpm 11 and later install with exit 0 instead of `ERR_PNPM_IGNORED_BUILDS`.
- The production auth readiness check says that a placeholder value (`re_...`, `your-google-client-id`) is not deferred by
  `NEXTSPARK_AUTH_RUNTIME_ONLY` and must be removed or replaced; the check itself is unchanged.
- `nextspark prepare`, `build` and `dev` recover from a run that was killed (SIGKILL, out of memory, power loss) while writing. The scratch files a
  killed writer leaves (`.<file>.<pid>.<id>.nextspark-tmp` under `src/app` and `.nextspark`, `<file>.nextspark-tmp` in `.nextspark/contracts`) and the
  registry build's `.nextspark/staging-*` directory are swept at the start of the next generation, under the lock. Before, a leftover scratch file in
  `src/app` read as "a file NextSpark did not generate" and every later `prepare`/`build`/`dev` refused to run until it was deleted by hand; the others
  stayed forever. Only the writers' own places are swept (`src/app` for a full generation, `.nextspark`, `.nextspark/registries`, `.nextspark/contracts`);
  backups and rollback snapshots are never touched, and a leftover in `packages/contracts` is not swept and does not block.
- **`db:migrate` records each migration in the same transaction that runs it.** It ran a file and then recorded it in `_migrations`,
  `_content_migrations` or `_entity_migrations` as a separate statement, so a run killed or disconnected between the two left the file applied but
  unrecorded, and the next run applied it again; a generated `001_*_table.sql` starts with `DROP TABLE IF EXISTS … CASCADE`, so that re-run dropped
  the rows written in between. Each file now runs as `BEGIN`, the file, its record, `COMMIT`: a run stopped anywhere before the `COMMIT` leaves
  neither, and the next run applies the file once. Effects that are not transactional (a sequence advanced with `nextval`) are not undone. A file that
  starts with `-- nextspark:no-transaction` runs as before, outside a transaction and recorded after it (the way to run `CREATE INDEX CONCURRENTLY`
  or `VACUUM`), and has to be safe to run again. Filenames, checksums and history tables are unchanged.
- **An interrupted `nextspark migrate` is named on the next run.** A run killed after it started writing left a half-converted tree, and the next dry run
  reported blockers unrelated to the cause (files the first run had already rewritten), with no mention of the rollback. `migrate --yes` now records what its
  rollback needs in `.nextspark/migrate-rollback/rollback.json` once its snapshot is complete; while `.nextspark/migrate-rollback` exists, `migrate`
  (dry run or `--yes`) says the previous run did not finish and prints the rollback commands, rebuilt by the CLI from that record (never read back
  as commands), instead of analyzing. A symlinked or git-tracked backup, or a record that names a path outside the generated host, is refused
  with nothing printed. The rollback's cleanup now matches paths literally: before, a preserved route such as `app/[slug]` was deleted by `find -path`,
  and `git clean` could remove an untracked `app/s`.

### Documentation

- Deployment overview: a "Self-hosting on Node" section (`next start`, and `output: 'standalone'` copied without the project), with what was checked.
- `17-updates`: what a package downgrade and `db:migrate` do (the database is never rolled back, `update-core` does not downgrade, `migrate` is one-way
  for files), and the day-one `minimumReleaseAgeExclude` step on pnpm 10 for projects created before `0.1.0-beta.193`.

## [0.1.0-beta.193] - 2026-10-02

### Upgrading from 0.1.0-beta.192

Nothing is mandatory: bump the `@nextsparkjs/*` dependencies, install and rebuild (`src/app` is regenerated). Optional: import `sel` from
`@nextsparkjs/core/selectors/<domain>` on pages where the bundle matters, and give a project block or item template that calls
`useSearchParams` on a statically rendered legacy route its own `<Suspense>` if the build asks for one (see the last Fixed item).
Two responses change status in the legacy host (`cacheComponents: false`), in case a project's own tests assert them: an invitation-only
`/signup` answers 307 to `/login` (it was 200 with a client-side refresh), and with core's default public layout an unknown one-segment
URL answers 404 (it was 200 with the not-found page). Under Cache Components both still stream: 200, with a client-side redirect or the
not-found page.
A project created before this release lists `<name>@<version>` entries under `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, which cannot
cover a release published less than a day ago: replace them with the package names (`'@nextsparkjs/core'`, `'@nextsparkjs/cli'`,
`'@nextsparkjs/ui'` and any other `@nextsparkjs/*` package the project installs) to install any NextSpark release the day it is published.

### Added

- **`@nextsparkjs/core/selectors/<domain>`**: one entry per selector domain (`auth`, `dashboard`, `entities`, `global-search`, `taxonomies`,
  `teams`, `block-editor`, `settings`, `superadmin`, `devtools`, `public`, `common`, `patterns`, `media`), each exporting `sel`, `s`, `selDev`,
  `cySelector` and its map bound to that domain only. A page importing `sel` from `@nextsparkjs/core/selectors` ships every domain's selector
  map (~9.5 kB gzip on the starter's `/login`); `import { sel } from '@nextsparkjs/core/selectors/auth'` ships the auth one. `@nextsparkjs/core/selectors`
  is unchanged. Core's own auth and public docs pages use the narrow entries.

### Fixed

- **A new NextSpark release installs the day it is published.** `create-nextspark-app` excluded the NextSpark packages from pnpm's one-day
  `minimumReleaseAge` as `<name>@<exact version>` of the release that created the project, so on pnpm 10 a project that bumped to the next release
  within 24 h of its publication was refused until it added those entries by hand. It now writes the package names (every `@nextsparkjs/*` package and
  `create-nextspark-app`), which no release age can outrun; every other dependency keeps the policy. Names, not `@nextsparkjs/*`: pnpm 10.16
  reads neither a pattern nor a version in an exclusion (checked on pnpm 10.16.0, 10.18.3, 10.34.6, 11.28.3 and 12.9.0).
- **Theme context is set at the first render.** `ThemeProvider` started with no theme and set it from a mount effect; that context change right
  after hydration made React discard the server HTML of any Suspense boundary not yet hydrated and render it again, so on a slow link a login form
  vanished for ~3 s and came back as a new node (LCP ~1.5 s to ~5 s on a production app). The theme comes from the build-time registry, so it is
  known at render 1 on server and client; the effect only applies the styles.
- **`/signup` of an invitation-only app answers a real 307 in the legacy host** instead of 200 with a `meta refresh`: the default page called
  `redirect()` inside its own Suspense. The page is `force-dynamic` and needs no boundary. Under Cache Components the redirect still streams
  behind the group layout's Suspense (200 with a client-side redirect).
- **`nextspark migrate`** says a missing active theme is the cause of the unrecognized `app/globals.css` blocker, and how to pass the theme.
- **Every project template creates, migrates, builds and serves from a new project** (`--theme blog|crm|productivity`; the starter already did):
  - The packages a template's source imports (`dompurify`, `next-themes`, `@dnd-kit/*`, `@tailwindcss/container-queries`) are now written into the
    generated `package.json`: `create-nextspark-app` left the template's own `package.json` out, so `pnpm build` failed with "Can't resolve 'dompurify'".
  - `--preset blog --theme blog`: the pages/blog content features no longer merge their `posts` entity over the one the template ships, which left two
    migration sets side by side (`002_add_featured.sql: column "status" does not exist`). The feature entity configs also stop hard-coding an `es`
    message loader, which broke a single-locale project (`Can't resolve './messages/es.json'`); the registry finds the messages by path.
  - `--theme crm`: `useCRMSidebar` moves out of the dashboard layout into `templates/shared/CRMSidebarContext.tsx` (Next allows only the default export
    from a layout, `NS_HOST_UNSUPPORTED_EXPORT`).
  - The starter, blog, crm and productivity `lib/selectors.ts` define the `hero` and `postContent` block selectors the content-feature blocks call, so
    `sel('blocks.hero.container')` never reaches a missing path.
  - `FeatureCategory` and `FlowCategory` accept a template's own categories (`'leads'`, `'sales'`, `'boards'`, the blog's `'public'`): the closed union failed
    the type check of the blog, crm and productivity `config/features.config.ts` and `flows.config.ts`.
  - The productivity services called `queryWithRLS`, `queryOneWithRLS` and `mutateWithRLS` as `(userId, sql, params)` and used the `mutateWithRLS` result as a row;
    the core signature is `(sql, params, userId)` and returns `{ rows, rowCount }` (type errors at build, wrong arguments at run time).
  - `devtools/blocks/[slug]` returns a placeholder param when the project has no blocks (the productivity template): Cache Components rejects an empty
    `generateStaticParams`, which failed the build.
- **Block selectors no longer pull every core domain onto a public page**: block components take `sel` from the project's `lib/block-selectors.ts`
  (`createSelectorHelpers({ blocks: BLOCK_SELECTORS })`) instead of `lib/selectors.ts`, which merges `CORE_SELECTORS` (~10.8 kB gzip). `lib/selectors.ts`
  re-exports `BLOCK_SELECTORS`, so Cypress and the merged `sel` see the same paths. Applies to apps/dev and to the starter, blog, crm and productivity templates. `PublicNavbar`, `PublicFooter` and `ThemeToggle` read `sel` from
  `@nextsparkjs/core/selectors/public` (the toggle's value is `public.navbar.themeToggle`, equal to `dashboard.topnav.themeToggle`), so a public page of apps/dev
  no longer carries the superadmin/devtools/team-switcher selectors.
- CI: the `template-build` job of `route-js-budget.yml` creates, migrates, builds and serves each of the four templates from the packed tarballs; the
  starter's route-JavaScript budget check stays on the starter. `packages/cli/tests/project-templates.test.ts` guards the same causes without a build.
- **An unknown URL answers 404 in the legacy host (`cacheComponents: false`) of a project that uses core's default public layout** (`crm`, and any project
  without `templates/(public)/layout`). `DefaultPublicLayout` wrapped the page in `<Suspense fallback={null}>`, so the
  `notFound()` of `(public)/[slug]` (the pages entity has `basePath: '/'`, so `/zzz-missing` matches it) arrived after the response head: 200 with the
  not-found page, and a redirect on `/` the same way (a client-side `meta refresh` instead of a 307). The boundary is gone from the default layout; the Cache
  Components wrapper keeps its own, which that mode needs.
  A project block or item template that calls `useSearchParams` on a statically rendered legacy route (a fixed locale, an ISR item route)
  used to sit inside that boundary; wrap it in its own `<Suspense>` if the build now asks for one.

### Documentation

- **The status of an unknown public URL, per rendering mode** ([Public rendering](docs/18-page-builder/07-public-rendering.md)). Under legacy it is a
  404 (a URL that matches no route is a 404 in both modes). Under Cache Components (the default) a URL that matches `(public)/[slug]` and has no
  published page answers **200** with the not-found page and `<meta name="robots" content="noindex">`: the prerendered shell, with its 200, goes out before the
  slug is read, and Next cannot change the status of a `notFound()` that arrives in the stream. That is why a fresh `starter` and `crm` answered 200
  while `blog` and `productivity` (no root `[slug]`) answered 404. The page builder docs said an unknown URL is a 404 because "no route matches"; the table
  now says which URL that holds for, and how a project that needs the status in Cache Components can answer it in `src/proxy.ts` (rewrite to `/_not-found`,
  as the template does for a missing docs page). Tests: `tests/node/public-item-not-found.test.ts`.

## [0.1.0-beta.192] - 2026-09-30

### Breaking

Every item is detailed under Added, Changed or Removed below; `nextspark migrate` does the move for a 0.x project
([Upgrading 0.x projects to 0.1.0-beta.192](docs/17-updates/06-upgrade-0x-projects.md)).

- **Root-first layout.** A project is the directory holding `nextspark.config.ts`; the former `contents/themes/<active>/` paths live at
  the project root and there is no project selection, `--project` flag or `NEXT_PUBLIC_ACTIVE_THEME` for the compiler. Every 0.x project
  must run `nextspark migrate` before it can run on this release.
- **`src/app` is generated and git-ignored; `nextspark sync:app` and core's postinstall writes are removed.** Nothing copies framework
  files into a project any more, and `packages/core/templates/app` no longer ships.
- **Project API routes move:** `/api/v1/theme/<theme>/**` is now `/api/**` and `/api/v1/plugin/<plugin>/**` is `/api/plugins/<plugin>/**`
  (`migrate` adds rewrites so installed clients keep working).
- **The theme packages are no longer published:** `@nextsparkjs/theme-default`, `theme-blog`, `theme-crm` and `theme-productivity` stay
  at `0.1.0-beta.191` and do not work with this release. Their content ships inside `@nextsparkjs/core` as the project templates
  (`starter`, `blog`, `crm`, `productivity`) that `create-nextspark-app --theme` uses. A 0.x project already has its theme copied under
  `contents/themes/`, which `nextspark migrate` moves to the root; if its `package.json` lists one of these packages, remove it.
- **Next.js is pinned to `~16.3.5`** for the generated host; the generator refuses another minor.
- **Entities named like a core API namespace are refused** (`NS_HOST_ENTITY_CORE_API_NAMESPACE`): `users`, `teams`, `auth`, `billing`, `cron`,
  `api-keys`, `devtools`, `media`, `media-tags`, `blocks`, `patterns`, `post-categories` and `team-invitations`. Rename the entity.
- **The code the generated host made dead is removed** (runtime API dispatchers, runtime template resolution, the legacy registry build;
  listed under Removed).
- **`BlockConfig.thumbnail` is the imported image (`{ src }`),** not a string path.
- **Stale `package.json` exports are removed:** `@nextsparkjs/core` `./theme-styles.css`, the bare `./lib/teams` and `./lib/permissions`,
  `./presets/*` and `./cypress-support`; `@nextsparkjs/ui` `./variants/*`; `@nextsparkjs/cli` `main`/`types` (the CLI is bin-only).
  Details in the [beta.192 status](docs/17-updates/03-beta-192-status.md).
- **`@nextsparkjs/core` depends on `@nextsparkjs/ui` through `workspace:*`,** published pinned to the same version.

### Added

- **The generated host (#203).** `nextspark prepare` plans and publishes the whole `src/app` as thin facades (static imports and literal
  segment config only, so no route's module graph selects a module at runtime), with precedence core < plugin < project. Core ships every
  framework route as a module (`@nextsparkjs/core/routes/*`, listed in `routes/manifest.json`); the project's `templates/` and `api/` are
  static overrides, a plugin's routes are served at `/api/plugins/<name>`, and core owns `/api/v1`. Output is recorded in
  `.nextspark/generation.json` and published atomically under an exclusive lock: a file is NextSpark's only while its bytes match, and
  anything else in `src/app` is refused, never overwritten. `prepare --check` writes nothing and fails on missing, stale, foreign or
  unfinished output; `predictHost` runs the same plan without writing. The emitter and the conformance suite
  (`scripts/performance/host-conformance.mjs`) prove the facades build like a hand-written Next.js app. See the
  [generated host](docs/01-fundamentals/08-generated-host.md).
- **One generated route set per entity** replaces `dashboard/(main)/[entity]` and the public catch-all: each route imports only its own
  entity, so client JS per route no longer grows with the number of entities (entity list pages are smaller in `apps/dev`).
- **Project templates that collide with an entity's generated dashboard routes replace that entity's whole generated subtree,** as a static
  template beat `[entity]` in 0.x; the entity's permission layout is kept at the top of every tree that serves the URL (a role the entity
  does not allow now sees `permission-denied`). `prepare`, `build` and `dev` print it as an Info notice. A page beside an optional
  catch-all at the same URL is `NS_HOST_URL_CONFLICT` instead of a failure inside `next build`.
- **A project can replace one entity's generic API handler (#203).** `templates/api/v1/<entity>/route.ts`, `[id]/route.ts`,
  `[id]/child/[childType]/route.ts` and `[id]/child/[childType]/[childId]/route.ts` are accepted for an entity of the project (or of an
  enabled plugin) and served at the static `/api/v1/<entity>/...`, which Next resolves before core's dynamic `[entity]` route; any other
  path under `/api/v1` stays `NS_HOST_API_NAMESPACE`, and core's own API namespaces (`users`, `billing`, `cron`, ...) are never an entity's: an entity named like one is refused (`NS_HOST_ENTITY_CORE_API_NAMESPACE`). `prepare` prints a warning (`NS_HOST_ENTITY_API_OVERRIDDEN`; `NS_HOST_CORE_API_REPLACED` when a template replaces a core route at its exact path): the override
  replaces the generic handler, so authentication, permissions and hooks become the project's responsibility (put business rules in
  entity hooks). See [Overriding an entity's API](docs/05-api/04-custom-endpoints.md#overriding-an-entitys-api).
- **Cache Components and PPR build and run (#203).** Core's group layouts, docs pages and public item pages have Cache Components variants
  that the host selects when `next.config` sets `cacheComponents: true` (runtime reads behind `Suspense` or `connection()`, cacheable reads
  in `'use cache'` functions keyed only by entity, slug or docs path). **It is the default for new projects;** legacy ISR stays supported
  and an existing project keeps its mode. `@nextsparkjs/core` declares `use-intl`, which it imports.
- **Plugin capabilities (#203).** `definePlugin({ name, capabilities: ['server' | 'web' | 'build' | 'mobile'] })`. The registry build and the
  host planner take from a plugin only what it declares (pages and layouts need `web`, Route Handlers and `api/` need `server`, build-only
  code never enters a runtime bundle) and fail naming the plugin, the capability and the file. A web or mobile entry must not reach
  server-only code. The plugins in the repository declare theirs; a plugin without `capabilities` is treated as server + web + build.
- **`nextspark check:mobile`** checks a web+mobile project's mobile import graph for server-only code (the checker ships in core; the
  monorepo's `pnpm mobile:boundary` wraps it). It works from a web host with its own `pnpm-workspace.yaml` and explains a layout it cannot
  check. Test files (`__tests__/`, `*.test.*`, `*.spec.*`, jest setup) are not seeds of the graph, since Metro never bundles them; files
  under an Expo `app/` tree always are, because each is a route.
- **Block thumbnails are imported** from `blocks/<slug>/thumbnail.png` by the block registry (see Changed).
- **`nextspark migrate`** (root-first layout and app tree conversion; see Changed) also: adds native Next rewrites so the old
  `/api/v1/theme/**` and `/api/v1/plugin/**` URLs keep answering; checks the project's `next` and `eslint-config-next` ranges (`~16.3.5`, resolving `catalog:` specs)
  and updates `package.json` with `--yes`; never rewrites AI-workflow directories (`.claude`, `.codex*`, `.gemini`, `.cursor`, `.superpowers`,
  `.agents`), listing their old references instead; creates `packages/contracts` in a web+mobile workspace and wires it in; predicts the
  generated host on a converted copy with `--dry-run` (`--no-simulate` skips it); and gives up on the registry after 10 s offline, saying how
  to rerun.
- **`nextspark skills`** serves an offline, versioned skill catalog from the installed CLI, and new projects get small, non-overwriting agent
  onboarding pointers (#201).
- **Production auth readiness (#202).** Runtime readiness gates the authentication endpoints and renders login, signup, invitation signup
  and recovery as available, unavailable or fail-closed; `nextspark prepare --production` and `build` fail when no login method can work
  (`NEXTSPARK_AUTH_RUNTIME_ONLY` declares the ones that work at runtime only; `NEXTSPARK_AUTH_PREFLIGHT=off` bypasses); the wizard collects
  or explicitly postpones the production sign-in provider.
- **`pnpm pkg:verify-tarballs`** verifies every packed tarball (exports targets exist, no `workspace:`/`link:`/`file:` specs, internal
  versions match, no `.env`, key material or token shapes) and runs before publishing (#204 gate G3).

- **Portable API contracts (#203):** `nextspark prepare` generates a zod-only module of DTO types and schemas from the project's entities
  (`packages/contracts` in a web+mobile project, `.nextspark/contracts` otherwise); `nextspark prepare --contracts-only [--check]` runs
  only that step. Requests are validated with the server's own schema generator (copied verbatim from the new
  `src/lib/entities/portable/`), responses are rendered from the columns the generic handlers select, and numeric wire types follow the
  `pg` driver. `childEntities` are serialized into the contract, or generation fails.

### Changed

- **Root-first layout (breaking).** The compiler reads a project from its own root; path resolution has a single owner
  (`scripts/build/registry/project-mode.mjs`). The theme's reserved middleware hook is `config/hooks/proxy.ts`, and the calls to the removed
  `hasThemeMiddleware`, `executeThemeMiddleware` and `getThemeAppConfig` are rewritten by `migrate` (call shapes it cannot rewrite safely
  stop it). The generated directory keeps the name `.nextspark/registries`.
- **Published plugins a project declares as dependencies are discovered** by the registry, and each published plugin declares a `files`
  allowlist (the release check fails if an allowlist would drop a directory the plugin needs).
- **Dependency security floors (#204 G1):** `@nextsparkjs/cli` `tar` `^7.5.21`, `@nextsparkjs/core` `sharp` `^0.35.4`,
  `@nextsparkjs/plugin-langchain` `handlebars` `^4.7.9`. `@nextsparkjs/testing` is no longer a runtime dependency of core.
- **Client JavaScript per route (#192, #207).** Overridden core routes have their own template scope (now replaced by static facades), each
  route group gets only the translations its client components use, and the root layout's theme provider reads small client-safe modules
  so dashboard and dev configuration no longer ship in every page.
- **Internal layout modules moved (#192)** so a public or auth route ships no superadmin, devtools or default-layout client code. Only
  hand-written imports of `@nextsparkjs/core/routes/_internal/*` are affected (the generated host is rewritten on every build):
  `DefaultPublicLayout` and `DefaultAuthLayout` moved from `_internal/public-layout` / `_internal/auth-layout` to
  `_internal/default-public-layout` / `_internal/default-auth-layout`; `withSuperadminGuard` and `withDevtoolsGuard` moved from
  `_internal/group-layouts.cc` to `_internal/superadmin-layout.cc` / `_internal/devtools-layout.cc` (the `(public)` and `(auth)`
  Cache Components wrappers are composed through `_internal/public-layout.cc` / `_internal/auth-layout.cc`).
- **The request proxy runs in root-first projects and they build with Turbopack.**
- **Scaffold:** a flat project's `.gitignore` is complete (`node_modules`, `.next`, `tsbuildinfo`, `next-env.d.ts`, `.nextspark`,
  `src/app`; an existing file only gains the missing entries); the template `tsconfig` has Next 16's values and `next.config` sets
  `agentRules: false`, so the first build or dev run leaves the tree clean; a web+mobile project's mobile app declares what Metro loads
  (`react-native-css-interop`, `react-native-worklets`, `babel-preset-expo`, `expo-device`); `create-nextspark-app` installs plugins from the
  local tarballs it was given; new projects advertise only real project templates.
- **`nextspark dev` on Turbopack recovers from syntax errors:** on a parse error in a template, an entity config or any changed source in
  the graph nothing is written until it parses again, so the fixed code is served instead of stale code.
- **Breaking: `BlockConfig.thumbnail` is now the imported image (`{ src }`).** The block registry sets it from `blocks/<slug>/thumbnail.png`
  through a static import (Next.js serves it as an asset; `/api/v1/blocks` returns `thumbnail.src`). A block `config.ts` must not set
  `thumbnail`: the old `thumbnail: '/theme/blocks/<slug>/thumbnail.png'` string no longer type-checks, and `nextspark migrate` removes it.
  The registry imports the file only if it is really a PNG (older scaffolds shipped text placeholders): otherwise it warns and the block
  has no thumbnail. The `public/theme/blocks` copies are gone from the scaffold.
- **New projects have no `src/app`.** `src/app` is generated by `nextspark dev`, `build` and `prepare` and is
  git-ignored (so is `.nextspark/`); the wizard writes the request proxy to `src/proxy.ts`, where Next.js loads it
  once `src/app` exists.
- **`nextspark migrate` converts the app tree** of a 0.x project instead of archiving it: files core generates are
  removed, customized core files become overrides under `templates/` (or `api/v1/**` overrides under
  `templates/api/`), project-only route files move to `templates/` or `api/`, billing webhook extensions are declared
  in `nextspark.config.ts` (`billing.webhookExtensions`), the project URLs that move to `/api/**` and
  `/api/plugins/<plugin>/**` are listed, and a file whose shape it does not recognize stops it before it writes.
  A root-first project with a committed `src/app` is converted too. `--no-prepare` skips the final generation. See
  [Upgrading a 0.x project](docs/17-updates/06-upgrade-0x-projects.md).
- Core's API Explorer docs and presets (`docs.md`, `presets.ts`) live next to each route module in the package
  (`src/routes/api/**`, shipped as source under `dist/routes/api/**`).
- The entity schema generator now lives in `lib/entities/portable/` (server-free) and is re-exported by `lib/entities/schema-generator.ts`;
  the generic handlers build their SELECT lists from `portable/response-shape.ts`. No behavior change.

### Fixed

- **Plugin capability check: `@nextsparkjs/core/lib/api/entities` (and `api-error`, `keys`) are client-safe.** The check treated all of `lib/api/**` as
  server-only, so a local plugin component using `fetchWithTeam` got a false `NS_PLUGIN_SERVER_IN_CLIENT` (it stopped `nextspark migrate` in
  `prepare`). A guard test now requires every `lib/api` module a core `'use client'` file imports to be classified client-safe.
- **Audit log (#206):** entries were never written, because the table had no insert policy for the application role (migration 028).
- **Calendar (#205):** the day grid stays mounted across parent renders (the three DayPicker components are module-level).
- **Unknown public URLs answer 404 again in ISR** (the starter's `(public)/loading.tsx` wrapped the catch-all). Under Cache Components Next
  still streams 200 with the not-found page and `noindex`.
- `/api/v1/cron/process` and `withRateLimit` rethrow Next's prerender interruption instead of swallowing it under Cache Components.
- `db.ts`'s SIGTERM/SIGINT handlers close the pools and then let the signal end the process, so `next build` no longer leaves its
  static-generation workers running.
- Debug `console.log` calls in client code run only in development.
- A media upload stores only real files from the form data.
- `migrate`: a dry run resolves the theme from the environment like one from `.env.example`; it ignores `next-env.d.ts` and says how to untrack
  it; its previous-core lookup is reliable and fetches templates with the user's registry auth; errors from the registry (credentials refused,
  version not served) are told apart from network failures.
- Theme and plugin proxy composition enforces core's authentication boundaries and fails unsafe rewrite targets closed (#204).
- The web template enforces TypeScript checks; the generated Cypress `tsconfig` resolves package `exports`; creating a project with a bundled
  theme or plugin no longer tries to fetch it from the registry; a project created from locally packed core resolves `@nextsparkjs/ui`
  from its local tarball too.
- Geist faces no longer preload; projects using `var(--font-geist-sans)` load
  them through normal CSS discovery with `font-display: swap`.
- Request interception now lives beside `src/app` (`src/proxy.ts` on Next.js 16,
  `src/middleware.ts` on Next.js 15), so Next discovers the authentication
  boundary and unauthenticated dashboard requests redirect to login. The wizard
  writes it, and `nextspark migrate` writes it when a project has none.

### Security

- **`/superadmin` and `/devtools` check the role on the server, whatever the project's proxy does.** Before, the role check lived only
  in the proxy and in the client guards (`SuperAdminGuard`, `DeveloperGuard`), so a project whose own `proxy.ts` lacked it (a proxy copied
  before core's template gained the check, which `migrate` keeps as written) served those pages with a 200 to anyone, with the server-rendered
  content in the RSC payload (superadmin docs, the API explorer's route map). Now the group layout's message wrapper and every page and
  layout under the area (core's, a plugin's or the project's; the generated host composes each with `withSuperadminAccess` /
  `withDevtoolsAccess`, and their `generateMetadata` with `withSuperadminMetadata` / `withDevtoolsMetadata`) read the session
  before rendering: no session goes to `/login`, a session without the role to
  `/dashboard?error=access_denied` (superadmin or developer for `/superadmin`, developer for `/devtools`). A legacy ISR host answers a page load
  with a 307; a Cache Components host has already sent its prerendered shell, so it answers 200 with a client-side redirect (meta refresh, or
  the RSC redirect) and nothing of the area in the body. Core's proxy template still refuses these requests first.
  A Route Handler under an area (a project's or a plugin's) answers 401 / 403 JSON before its code runs (`OPTIONS` excepted), and
  an intercepting route (`@modal/(.)superadmin/...`) is checked by the URL it intercepts. Metadata files under an area cannot be
  guarded: `nextspark prepare` warns about each one (`NS_HOST_AREA_FILE_UNGUARDED`). Server Actions and `loading` / `error` /
  `not-found` files are not covered and must check or stay free of area data themselves.
  `OPTIONS` handlers under an area are forwarded unchecked (a CORS preflight carries no credentials): they must not return data.
- **A visitor with no session cookie gets a 307 to login from `/superadmin` and `/devtools`, in Cache Components mode too.**
  The scaffold's `next.config.mjs` (core's `templates/next.config.mjs`) adds `redirects()` for both areas, applied only when neither
  Better Auth session cookie (`__Secure-better-auth.session_token`, `better-auth.session_token`) is present; a signed-in user
  without the role still reaches the proxy and core's server check. Existing projects can copy the `roleGatedAreaRedirects` block.
- **`nextspark prepare` and `nextspark migrate` warn when the project's proxy does not protect `/superadmin` or `/devtools`**
  (`NS_PROXY_PROTECTED_AREA_MISSING`), naming each area the proxy never mentions and the check to copy from core's proxy template:
  without it a signed-in user without the role gets a 200 with a client-side redirect instead of a 307.
- **`/api/v1/devtools/*` requires the developer role (or a developer's API key with `admin:devtools`); superadmin no longer
  has access**, the same rule as the `/devtools` pages and `/api/devtools/*`. `GET /api/v1/devtools/docs` now authenticates at all:
  it answered any request before, serving the API documentation files.
- **The dashboard's permission checks take the user from the verified session**, not from the proxy's identity headers.
  `EntityPermissionLayout` and the `dashboard/(main)` layout read the session (`lib/auth/request-session`) and the team from the
  `activeTeamId` cookie that session wrote; `x-user-id`, `x-user-email` and `x-active-team-id` are no longer trusted (a project's
  own proxy may forward them as the client sent them). `x-pathname` stays a routing hint. `getDashboardTeamId(userId, chosenTeamId)`
  replaces `getDashboardTeamId(headers, userId)`.

### Removed

- **`nextspark sync:app` and every write core's postinstall made into a project (#203, removed in
  beta.192, not deprecated).** Core's postinstall now only prints a notice in a project that still has a
  committed `src/app` or `app/`. `packages/core/templates/app` no longer ships (`pkg:pack` refuses to pack it and
  `pkg:verify-tarballs` fails a core tarball that has it), and the `sync:templates` scripts that copied
  `apps/dev/src/app` into it are gone. `pnpm update-core` ends with `nextspark prepare`. See the
  [removal timeline](docs/17-updates/05-sync-app-removal.md).

- **The code the generated host made dead (#203, stage 6; breaking, removed in beta.192, not deprecated).** Nothing
  in a project on the generated host used it; a project that imported one of these paths must stop:
  - *Runtime API dispatchers and handler lookups:* the `api/v1/theme/**` and `api/v1/plugin/**` route modules
    (`@nextsparkjs/core/routes/api/v1/theme/*`, `.../plugin/*`, the info endpoints included), `RouteHandlerService`
    and its `RouteHandler` type (`@nextsparkjs/core/lib/services`), and `THEME_ROUTE_HANDLERS` /
    `PLUGIN_ROUTE_HANDLERS` in the route-handlers registry. The registry keeps `API_ROUTES_METADATA` and
    `API_ROUTES_SUMMARY` (`ApiRoutesService`, used by the devtools).
  - *Retired core route modules and their runtime seams:* `routes/dashboard/(main)/[entity]/**`,
    `routes/(public)/[...slug]/page`, `routes/_internal/{entity-list-page,entity-detail-page,public-catch-all-page}`
    (`createEntityListPage`, `createEntityDetailPage`, `createDynamicPublicPage`) and
    `lib/api/entity/public-resolver` (`resolvePublicEntityFromUrl`). The per-entity routes forward `metadata`, `error`
    and `loading` from `routes/_internal/entity-{list,detail}-metadata`, `entity-error` and `entity-loading`.
  - *Runtime template resolution:* `getTemplateOrDefault`, `getMetadataOrDefault`, `useTemplateOverride`,
    `withTemplateOverride` (`lib/template-resolver`), `TemplateService` (`lib/services/template.service`), the
    `TemplateOverride` / `TemplateRegistryEntry` types (`types/theme`), and the `template-registry`,
    `template-registry.client` and `template-scopes/**` registries (`CONTENTS_REGISTRY.templates` and
    `TemplatePath` from the unified registry with them). A project template is a static override of the generated route.
  - *The legacy registry build into `src/app`:* the `(templates)` page generation, its cleanup and plan
    (`templates-plan.mjs`), `syncAppGlobalsCss`, the registry watcher (`registry.mjs --watch`) and the
    `legacy-app` preparation mode. `registry.mjs` writes registries only, and is run by `nextspark prepare`.
    `nextspark prepare`, `build` and `dev` on a project whose `src/app` is a committed app tree no generation owns
    now fail pointing to `nextspark migrate` (they used to run the legacy build silently). `registry:build`,
    `registry:watch` and `generate` are names for `prepare` and `prepare --watch`; `--registry` and `dev:registry`
    no longer start a separate watcher.
  - `RETIRED_FROM_MANIFEST` (`routes-manifest.mjs`) and the `test:template-route-conformance` script (the runtime
    scopes it compared are gone; `node scripts/performance/host-conformance.mjs` checks the generated host).

- **`scripts/build/theme.mjs`** (`@nextsparkjs/core/scripts/build/theme.mjs`, nothing called it): it wrote `.next/theme-generated.css`, which nothing read; the generated root layout imports `styles/globals.css` directly.

- **The project-selection machinery of 0.x:** `NEXT_PUBLIC_ACTIVE_THEME` and the `--project` flag for the compiler, the `contents/`
  symlinks, and the theme-selection test harnesses. `blog`, `crm` and `productivity` are install-once project templates under
  `packages/core/templates/projects/`.

## [0.1.0-beta.191] - 2026-09-18

### Fixed

- **Route-scoped template registries (#192):**
  - Re-architected template registry generation to produce route-scoped registries under `@nextsparkjs/registries/template-scopes/server/` and `template-scopes/client/`, replacing the monolithic flat template registry.
  - Resolved the source-structure cause of cross-area template fan-out in the tested `apps/dev` scopes: generated `src/app/(templates)` artifacts are excluded during scope discovery for idempotent builds, while server scopes are explicitly marked `server-only`. This does not establish blanket closure of the original Shendo issue; consuming-app validation remains pending.
  - Eliminated namespace collisions between server and client route scopes (`foo.ts` vs `foo.client.ts`), added robust detection for `server-only` imports (including side-effect `import 'server-only'`), and preserved metadata truthy-fallback parity with `template-resolver.ts`.
  - The temporary causal experiment in `scripts/performance/fixtures/registry-causal-comparison.json` reports root allowed-mode decoded JavaScript of `1,346,001 B` before and `1,119,973 B` after, a `226,028 B` saving. The experiment used an unauthenticated dashboard; these are not final production before/after measurements. Source maps remain opt-in.
  - The entire registry test suite reports 266 tests (the focused scope test has 22); the initial registry baseline was 264 tests.
  - Added an explicit package export for the API Explorer and replaced the remaining `TestCasesViewer` barrel import with its deep import.

### Added

- **Route JavaScript budget verifier (#192):**
  - Added `scripts/performance/verify-route-js-budget.mjs`, `scripts/performance/apps-dev-route-js-budget.json`, and tests in `scripts/performance/verify-route-js-budget.test.mjs` for browser-observed decoded JavaScript budgets.
  - Added strict `prefetchRequests` accounting for schema v2 and v3 captures, and tests against the real tracked budgets. The CI gate is tests-only: it runs deterministic verifier tests; it does not build the app, start a browser, or perform browser measurement.

- **Registry-driven MCP (Model Context Protocol) server engine (`@nextsparkjs/core/lib/mcp`, #98).**
  Every `access.api`-enabled entity in the entity registry now gets a working MCP tool
  surface for free — `list`/`get`/`create`/`update`/`delete` tools generated from each
  entity's field definitions, with zero per-entity code. See
  [docs/05-api/20-mcp-server.md](./docs/05-api/20-mcp-server.md).
  - **Engine** (`engine.ts`, `tool-generator.ts`, `schema-builder.ts`) builds a JSON-Schema
    presentation layer from `EntityField[]` (the core's own `generateEntitySchemas` output
    can't back `tools/list` — some field types use a `z.union([..., z.undefined()]).transform()`
    shape `z.toJSONSchema()` rejects). The presentation layer also hardens the generated
    `list` tool against known silent-failure modes of the generic list endpoint: strict
    unknown-key rejection, a `sortBy` enum restricted to sortable fields, `datetime` fields
    excluded from `filters` (equality against a timestamptz silently returns `[]`), a
    `dateField`/`from`/`to` cross-field rule, and `distinct` never exposed.
  - **Executor** (`executor.ts`) invokes the real `handleGenericList/Create/Read/Update/Delete`
    handlers in-process with a synthesized request — the exact same code path
    `/api/v1/{entity}` uses, so every tool call inherits the fixed scope + team-role
    permission + ownership/field-guard enforcement (#94, #95) automatically. No separate
    authorization layer is re-implemented in the MCP engine.
  - **Transport** (`transport.ts`) is a ~80 LOC stateless in-memory `Transport` adapter,
    since the SDK's `StreamableHTTPServerTransport` requires Node's
    `IncomingMessage`/`ServerResponse`, unavailable in the Next.js App Router request model.
  - **Registry discovery**: a theme customizes one entity's MCP surface by adding
    `entities/<slug>/mcp.ts` (`McpEntityOverride` — exclude, excludeOperations,
    relaxRequired, describe, errorHints, transformInput/transformOutput, extraTools),
    auto-discovered by a new `mcp-overrides` registry generator the same way
    `entities/<slug>/api/presets.ts` is discovered today — no manual import list to maintain.
  - **Audit**: every tool call, success or failure, is written to `api_audit_log` with an
    `mcp:<tool>` endpoint prefix.
  - New dependency: `@modelcontextprotocol/sdk` (`zod` was already in core's dependency tree).
  - New package export: `@nextsparkjs/core/lib/mcp`.
- **Audit logging for the generic entity routes (#105).** Every authenticated
  request to `/api/v1/[entity]` and `/api/v1/[entity]/[id]` — session or
  API-key — now writes an `api_audit_log` row (endpoint, method, status code,
  IP, user agent, response time; `apiKeyId` for API keys, `NULL` for
  sessions). Logging is fire-and-forget and never affects the response. The
  request body is not stored.
  - **Migration `025_api_audit_log_nullable_api_key.sql`** drops the `NOT NULL`
    on `api_audit_log."apiKeyId"` (the FK is unchanged). Run `db:migrate`.
  - `DualAuthResult` gains `keyId` (the authenticating `api_key.id`) so the
    audit row can be attributed without an extra lookup.
  - MCP tool calls now produce two rows: the existing `mcp:<tool>` row and the
    underlying API call's row.

### Changed

- **zod is imported as a namespace: `import * as z from 'zod'` (#192).** Turbopack, the
  default bundler in Next 16, doesn't tree-shake the named `z` import, so a client
  component that imports it ships all of zod with its 63 locales. Core, its templates and
  the bundled themes and plugins changed; code that uses `z` stays the same.
  - `sync:app` doesn't touch `contents/`. In a project, replace the import in your theme
    and plugin files, starting with the block schemas
    (`blocks/*/schema.ts`): `import { z } from 'zod'` →
    `import * as z from 'zod'`, and `import type { z } from 'zod'` →
    `import type * as z from 'zod'`.
  - New projects get an `eslint.config.mjs` with a `no-restricted-syntax` rule that rejects
    the named import. An existing project keeps its own config; add the same rule to it.
- **Next.js 16 is what `init` generates, and Next 15 keeps working (#192).** A project created
  with `create-nextspark-app` installs `next@16.3.5`, pinned like `next-intl` and
  `better-auth`; `nextspark init` adds `next@^16.3.5` to a package.json that declares no `next`
  yet. An existing project on Next 15 keeps building and running, and core's `next` peer is
  `>=15.0.0`. What an existing project sees when it updates core:
  - **`revalidateTag` is called through `@nextsparkjs/core/lib/cache/revalidate-tag`.**
    Next 16 requires a `cacheLife` profile as the second argument and rejects the
    one-argument call at type-check time, while Next 15 declares one parameter and rejects
    the two-argument call. The helper passes `{ expire: 0 }`, which Next 16 routes through
    the same branch as no profile at all, so tags still expire immediately instead of
    turning into stale-while-revalidate. Nothing to change in project code: the entity
    actions already call it.
  - **`next.config.mjs` attaches its `webpack()` function whenever webpack builds:** Next 15
    by default, and Next 16 with `--webpack`. It points `@nextsparkjs/registries` at the
    generated directory, which webpack does not resolve from core's own imports otherwise.
    Turbopack never reads it and resolves the registries through the `paths` of
    `tsconfig.json`. A project that copied the template config keeps its own copy until it
    re-syncs.
  - **The generated `lint` script is `eslint .`,** since Next 16 removes `next lint`, and
    `eslint-config-next` moves to `^16.3.5`. An existing project keeps whatever `lint`
    script it already has. The template `eslint.config.mjs` holds the whole project to Next's
    presets, `app/` and `contents/` included, and leaves out only tests and fixtures (`tests/`,
    `__tests__/`, `__mocks__/`, `fixtures/`, `cypress/`, `*.test.*`, `*.spec.*`, `*.cy.*`,
    Jest and Cypress config), which get the zod rule alone. An `any` or an `<img>` fails the
    lint: `@next/next/no-img-element` is an error rather than the presets' warning. The rules
    eslint-plugin-react-hooks 7 adds for the React Compiler (`set-state-in-effect`, `refs`,
    `immutability` and the rest) warn instead of failing, since NextSpark does not build with the
    React Compiler; `rules-of-hooks` still fails. The themes and plugins NextSpark ships no longer
    use `any`, so a new project lints without errors. With `eslint-config-next` 15 it reads
    Next's presets through `FlatCompat`.
  - **Themes and plugins take `next` `^15.0.0 || ^16.0.0` as a peer,** as do the package.json
    examples in the `create-theme` and `create-plugin` skills. With `^15.0.0`, pnpm installed
    a second Next, a 15, inside each theme and plugin of a Next 16 project. An existing
    project keeps `^15.0.0` in its copies under `contents/` until it edits them, or re-adds
    the theme or plugin with `--force`, which replaces the whole directory.
  - **Node 20.9 is the floor** for the CLI and `create-nextspark-app`, as Next 16 requires.
  - **`create-nextspark-app` writes the build-script allowlist the project's own pnpm reads:**
    `allowBuilds` in `pnpm-workspace.yaml` for pnpm 11, `pnpm.onlyBuiltDependencies` in
    `package.json` for 10 and 9. It asks pnpm for its version from the project's directory,
    since Corepack takes the version from the nearest `packageManager` field and the directory
    the command starts from can resolve another pnpm. The list adds `protobufjs` and `sharp`,
    and a core installed from a local tarball is listed by its `file:` spec, the only form pnpm
    matches it by; pnpm 11 failed the install with `ERR_PNPM_IGNORED_BUILDS` over each one left
    out.
  - **A new project declares `@better-fetch/fetch` `1.3.1`,** the exact version better-auth
    depends on and `@better-auth/core` requires as a peer. `create-nextspark-app` added it
    unversioned and `nextspark init` as `^1.1.0`, both resolving 1.3.2, an unmet peer that stops
    an install with strict peers.
  - **The langchain plugin moves to `@langchain/openai` `^0.6.17` (with `@langchain/core`
    `^0.3.68`, its floor) and drops `@langchain/community`,** which none of its code imports.
    0.3 converted zod schemas through `openai/helpers/zod`, which reads only zod 3, so every tool
    and structured-output schema the plugin wrote with zod 4 reached OpenAI as an empty JSON
    Schema. `@langchain/community` brought Stagehand, whose `zod ^3.23.8` peer failed. One peer
    stays unmet and stops an install with strict peers: `openai@5.12.2`'s optional
    `zod ^3.23.8`, whose zod helpers 0.6 only calls for zod 3 schemas; the default install is
    unaffected. `.describe()` texts still don't reach the model: `@langchain/core` 0.3 converts
    with its own zod 3.25, whose registry doesn't hold zod 4's metadata. An existing project keeps
    the old dependencies in `plugins/langchain` until it re-adds the plugin with
    `--force`.

- **`generateTemplateRegistry()` returns `Promise<string>` (#197).** It reads each theme
  template's syntax tree to tell a component override from a metadata-only one, and the
  TypeScript parser loads asynchronously. Code importing it from
  `@nextsparkjs/core/scripts/*` needs to `await` it, as `scripts/build/registry.mjs` does;
  `generateTemplateRegistryClient()` was already asynchronous. The generated registry is
  still a static file written at build time, and a template with no default export is now
  registered with `component: null` instead of a deferred import.
- **The root layout no longer mounts `TeamProvider` and `SubscriptionProvider` (#187).**
  On a public page they fetched a signed-in visitor's teams and subscription and
  re-synced the `activeTeamId` cookie with `POST /api/v1/teams/switch`; a role
  without billing access got a `403` for the subscription, retried three times.
  The dashboard, superadmin and devtools layouts now get both providers through
  `DashboardProviders`, which under the root layout's `QueryProvider` adds only
  those two (one query cache, one `Toaster`). The subscription query no longer
  retries a `4xx`.
  - `app/layout.tsx` is regenerated by `sync:app`, which core's postinstall runs.
  - A route group of your own, outside those three areas, that uses team hooks
    (`useTeam`, `usePermission`, `PermissionGate`, `useSubscription`, …) has to
    wrap its layout in `DashboardProviders`; otherwise those hooks throw
    `must be used within TeamProvider`.
- **Rendering a page reads from the request only what it needs (#188, #189, #190).**
  The root layout used to read the session, query the user's language and make
  an HTTP request back to `/api/user/profile` for the theme on every render, and
  the i18n request config read `headers()` for a pathname it never used, so no
  page of any project could be prerendered.
  - `getUserLocale()` resolves the locale once per request (React `cache`): the
    locale cookie, then the signed-in user's language from the session, read
    only when the request carries a session cookie and without a separate query,
    then `Accept-Language` by quality, then the default locale. An anonymous
    visitor's page reads no session and runs no query.
  - An app with a single locale, or with the new `i18n.localeDetection: false`,
    renders its default locale without reading the request.
  - The next-intl request config reads nothing from the request and takes the
    locale its caller passes. `NAMESPACE_GROUPS` and `getPageNamespaces` are
    deprecated: they never decided what a request loads.
  - `getThemeSettings()` reads configuration only. A signed-in user's saved
    theme is applied in the browser, once per tab for each user, where no theme
    is stored yet; a profile request that fails is tried again with the next
    session read, and an answer that arrives after a sign-out is dropped.
  - The locale cookie now decides before the account: it is written on sign-in
    with email or a one-time code, and `SessionCookieRefresher` rewrites it,
    refreshing the page, when the account's language changed elsewhere. It is
    always written readable, since client code rewrites it: `setUserLocale` no
    longer applies `i18n.cookie.httpOnly`. A page that stays in another language
    is refreshed once per language, not on every session read. No flow in core
    wrote the cookie HttpOnly; a browser holding one a project's own server code
    wrote keeps it until `setUserLocale` replaces it or it expires.
- **An anonymous visitor's page makes no session request (#187).** Better Auth's
  session cookie is httpOnly, so a readable `nextspark.signed_in` cookie
  (`lib/auth/session-hint`) records whether the browser was last seen signed in.
  `SessionCookieRefresher`, `PublicNavbar`, `ThemeToggle` and the default theme's
  home ask for the session only then, following the hint as a sign-in or
  sign-out on the page changes it (`subscribeSessionHint`, `useSessionHint`); a
  session read still on the wire when the user signs out is discarded, and the
  PPR root layout (`layout.ppr.tsx`) mounts `SessionCookieRefresher` as well.
  `useAuthActions()` offers the auth actions
  without subscribing to the session; the login and signup forms and the
  password reset pages use it.
- **The one-time code email states the expiry the code really has (#186).** It
  said 5 minutes whatever `auth.otp.expiresIn` was. It now receives the
  configured expiry (`OtpVerificationEmailData.expiresIn`) and pluralizes it in
  the six locales, rounded down so it never promises more time than the code
  has ("less than a minute" under 60 seconds). The login form's countdown always
  reads `m:ss`, counts from the moment the code was requested, never shows more
  than the code's lifetime and stops at zero. The mobile app accepts codes of 4
  to 10 digits, the lengths `auth.otp.otpLength` allows.
- **Theme pages keep their route segment config (#191).** The registry generator
  forwarded `revalidate`, `dynamic` and the rest with `export { … } from`, which
  Next.js ignores, so a theme page could not declare them. It now re-declares
  `revalidate`, `dynamic`, `dynamicParams`, `fetchCache`, `runtime`,
  `preferredRegion`, `maxDuration` and `experimental_ppr` as literals in the
  generated route file, forwards functions and `metadata` as before, and does
  the same for layouts. A template that declares one of those keys as anything
  but a literal fails the registry build, naming the file, key and line.
  Whether a layout template exports a component is read from the same syntax
  tree, so a comment that mentions `export default` no longer imports a missing
  default and `export { Layout as default }` no longer falls back to a
  pass-through. Each template is parsed as its own kind of file (`.ts` or
  `.tsx`), and one that does not parse fails the build with its file and line.
  Parsing templates needs `typescript`, resolved from core or from the project.
- **`TASK_CATEGORIES` and `TASK_PRIORITIES` (`@nextsparkjs/core/types`) are in English.**
  The categories are `'Design'`, `'Development'`, `'Meetings'` and `'Documentation'`
  (were `'Diseño'`, `'Desarrollo'`, `'Reuniones'` and `'Documentación'`), and the
  `TaskCategoryType` union follows them; the priority labels are `High`, `Medium`
  and `Low` (were `Alta`, `Media` and `Baja`). Nothing in core reads or stores
  them. A project that compares against or persists the Spanish values has to
  update them.

- **Docs access follows `docs.publicAccess`, and missing docs pages answer 404.**
  The docs area read only the `publicAccess` setting, so a project that had set
  the older `docs.public: false` exposed its docs; it is now read as private. The
  proxy answers 404 for `/docs` and `/superadmin/docs` pages the docs registry
  lacks, instead of rendering a "Page Not Found" page with status 200. A
  project's tests that assert the old status code need updating.
  - `proxy.ts` / `middleware.ts` is rewritten by `sync:app`.

### Security

- **The generated proxy enforces the roles `/superadmin` and `/devtools` need.**
  Both areas were guarded only in the browser, by `SuperAdminGuard` and
  `DeveloperGuard`, after the page had been served. The proxy now sends a visitor
  without a session to login, and a signed-in user without the role
  (`superadmin` or `developer` for `/superadmin`, `developer` for `/devtools`) to
  `/dashboard?error=access_denied`.
  - Its matcher no longer skips paths that end in an image extension, which let
    `/superadmin/users/alice.png` bypass the session check with forged identity
    headers intact; only `_next/static/`, `_next/image` and `favicon.ico` stay out.
  - Protected areas are matched by path segment, so `/dashboard-guide` or a
    public `profile-photo.jpg` no longer requires a session.
  - Redirects keep the base path and locale, and the session is looked up at the
    auth route under the base path.
  - The redirect to login always sets `callbackUrl` to the page asked for, query
    included. Private docs used `redirect`, which the login form does not read,
    so signing in now returns to the document instead of the dashboard.
  - `proxy.ts` / `middleware.ts` is rewritten by `sync:app`.

- **Signing in only returns to a page on this app.** The login and signup forms
  followed `callbackUrl` wherever it pointed, so a link such as
  `/login?callbackUrl=//evil.example` sent the user to another site right after
  they signed in with a password or a one-time code. Only a path on this origin
  is followed now (`safeCallbackPath`, `lib/auth/callback-url`); anything else
  falls back to `/dashboard`. Google sign-in applies the same check, and writes
  the callback's query percent-encoded, since Better Auth rejects a relative
  callback whose query holds a `:` (a timestamp, a filter).

- **The `activeTeamId` cookie only counts for the session that wrote it.** It lives
  for a year, so after a sign-out the next person to sign in on the same browser
  was checked against the previous user's team: a dashboard deep link answered
  with a false permission denial, and server actions acted in that team.
  `/api/v1/teams/switch` now writes it as `<session id>:<team id>`, and readers
  take the team only for their own session (`activeTeamIdForSession`,
  `lib/teams/active-team-cookie`): the proxy forwards it to the dashboard layouts
  as `x-active-team-id`, and server actions and `resolveTeamContext` check it
  themselves. The cookie stays host-only, so each subdomain of a multi-tenant
  app keeps its own team.
  - A cookie written before this release carries no session and names no team
    until `TeamContext` writes it again, which it does when the dashboard mounts.
  - The dashboard layouts check permissions in that team while the user still
    belongs to it and it is not deleted, and in the user's default team (the
    earliest joined) otherwise (`getDashboardTeamId`, `lib/teams/dashboard-team`);
    `sync:app` updates them. A failed lookup stops the render instead of reading
    as a user in no team, whose permissions are not checked, and the dashboard
    layout and the entity layout under it share one query per request.
  - TeamProvider reads every page of `/api/v1/teams`, so the default team the
    server falls back to is always among the ones it chooses from, retries a
    cookie write that fails, and sends one switch request at a time, aborting one
    that has not answered in 10 seconds, so a late answer for a team chosen
    earlier cannot leave the cookie on it.
  - API-key requests no longer fall back to a browser's `activeTeamId` cookie;
    they send `x-team-id` or get the user's default team, and
    `POST /api/v1/teams/switch` answers an API key with `400 SESSION_REQUIRED`.
  - Signing in or out empties the query cache, and TeamProvider keys the teams
    it caches by user, so the next user on the same page never sees the
    previous one's teams.

- **API-key scope minting now matches scope enforcement (#94).** `validateScopesForUser`
  — the gate deciding which scopes a user may mint into an API key — previously checked
  a hardcoded map keyed by the caller's **global** `users.role`, referencing a
  nonexistent role (`colaborator`) and missing `owner`/`viewer` entirely. Independently,
  the scope-registry generator that was supposed to back this was dead code: it read
  entity properties (`entity.api.endpoints`, `entity.features`) that don't exist on the
  real entity-discovery shape, so `SCOPE_CONFIG.roles` was 100% hardcoded, wrong JSON
  referencing a nonexistent `products` entity. Net effect: **no non-superadmin user
  could ever mint a working API key for their own theme's entities.**
  - The scope-registry generator (`scope-registry.mjs`) now emits a file that computes
    `SCOPE_CONFIG.roles` at import time, deriving `<slug>:read/write/delete` per
    API-exposed entity from the same team-role permission matrix
    (`PERMISSIONS_BY_ROLE`) the request-time authorization check uses — scope minting
    and scope enforcement can no longer drift apart.
  - `validateScopesForUser(userId, teamId, requestedScopes)` now takes an explicit
    `teamId` and resolves the caller's real **team** role via `TeamMemberService`,
    with an explicit bypass for the global `superadmin` role (which is not a team role
    and never appears in `AVAILABLE_ROLES`).
  - `POST /api/v1/api-keys` now resolves team context (`x-team-id` header / cookie /
    default team) before validating requested scopes, for any non-superadmin caller.
  - Fixed a satellite bug: `handleGenericDelete` checked the entity's `:write` scope
    instead of `:delete` — a write-scoped key could delete, and the `:delete` scope was
    pure decoration.
  - Removed the undocumented, unmintable `admin:all` scope from `hasRequiredScope` —
    dead code (nothing could mint it) and a latent, undocumented full-access string.
    Use `*` instead.

- **API-key authentication no longer bypasses team-role permission checks, field
  guards, or ownership-based row filtering on the generic entity routes (#95).**
  `/api/v1/[entity]` previously ran three authorization layers — a team-role
  permission check, per-role field write guards, and ownership-scoped row
  filtering — only for session-authenticated requests, explicitly skipping all
  three for API-key auth on the stated assumption that scopes alone governed
  API-key requests. Scopes only ever expressed entity+operation granularity, so a
  scoped key could read/write outside its owner's team role, ownership scope, or
  field restrictions — broader access than the same user's own session. All three
  checks now run identically for both auth types.

- **API-key scope enforcement now fails closed at the auth entry points (#93).**
  Scopes were validated on creation, stored and returned, but nothing in the
  request path required a route to check them: `authenticateRequest` handed back a
  populated `scopes` array nobody was obliged to look at, so a key minted as
  `tasks:read` authenticated on every route that only gated on its owner's role —
  with that owner's full permissions (team management, invoices, DevTools, ...).
  Scopes looked like an access control and behaved like a label. The default is
  now the secure one:
  - `authenticateRequest(request, { requiredScope })` declares the scope(s) an API
    key must hold (a string, or an array satisfied by any one entry; `*` always
    passes). A key without it is rejected with **403 `INSUFFICIENT_SCOPE`**.
  - A route that declares nothing rejects API keys with **403 `SCOPE_NOT_DECLARED`**
    and names the route in the server log — forgetting is now visible instead of
    silently over-privileged. Routes that genuinely accept any valid key say so with
    `{ allowAnyScope: true }` (explicit and self-documenting). Session auth has no
    scopes and is unaffected.
  - A key rejected on scope never falls back to cookie auth nor degrades to
    public/anonymous access on public entities.
  - `createAuthFailureResponse(authResult)` turns a failed result into the right
    response (401 `AUTHENTICATION_FAILED` vs 403 scope codes); `DualAuthResult`
    gains `error: { code, status, message }` on failures. `hasRequiredScope` accepts
    an array (any-of) for finer, secondary checks.
  - The same rule applies to the helpers entry point:
    `validateAndAuthenticateRequest(request, { requiredScope | allowAnyScope })`
    resolves `{ auth: null, errorResponse }` (a ready-made 403) for a rejected key.
    `checkScope` now honours the `*` wildcard and any-of arrays.
  - `hasAdminPermission(authResult)` without a `requiredScope` now denies API keys
    instead of granting a narrow key its superadmin owner's full permissions.
  - The generic entity handlers declare `<slug>:read|write|delete` at the entry
    point (the in-handler `hasRequiredScope` checks they duplicated are gone), and
    every route in `apps/dev`, the default theme and the social-media-publisher
    plugin declares its scope.
  - New core scopes for routes that had none to declare: `teams:read|write|delete`,
    `billing:read|write`, `admin:devtools`. Themes declare their own in
    `app.config.ts` → `api.scopes`, which `getApiScopes()` merges into the mintable
    vocabulary (the default theme adds `ai:read|write` and `social:read|write` for
    its AI routes and the social-media-publisher plugin).
  - **Upgrade notes:** every custom route calling `authenticateRequest` /
    `validateAndAuthenticateRequest` must declare `requiredScope` (or
    `allowAnyScope`) or its API-key callers get 403 `SCOPE_NOT_DECLARED`. Existing
    keys used against teams/billing/DevTools routes need the new scopes (a
    superadmin can mint them; minting rules for non-superadmins are unchanged).
    Anonymous and session behaviour is unchanged.

- **SQL identifier injection in the generic list `distinct` query (#96).**
  `GET /api/v1/{entity}?fields=X&distinct=true` interpolated the raw `fields`
  value as a quoted SQL identifier without validating it against the entity's
  fields — unlike the sibling non-distinct branch — so any caller with
  `<slug>:read` could inject SQL into the SELECT list. The name is now
  validated first (`400 INVALID_FIELD`) through the same `isEntityField` check
  both branches share.

### Fixed

- **`validateAndAuthenticateRequest()` no longer throws for anonymous requests (#112).**
  The session-or-API-key helper in `lib/api/helpers.ts` fell back to the strict
  API-key-only variant when no session was found, which threw `Invalid API key` when
  no key was present either. Routes that wrap the call in a generic try/catch (the
  usual pattern for a stable JSON error envelope) therefore answered a plain
  unauthenticated request with a **500** instead of the 401 their own `!auth` branch
  produces. The helper now resolves to `{ auth: null }` — matching its own
  session-lookup failure behaviour — so routes' existing 401 branches work as
  written. `validateAndAuthenticateApiRequest` (API-key-only) keeps its throwing
  contract; a shared internal applies rate limiting for both.
  - **Type change:** the resolved `auth` is now `Auth | null`; callers must branch on
    it before reading `auth.userId` / `auth.scopes`.

- **`beforeEntityCreate` is now invoked by the generic create handler (#118).**
  `POST /api/v1/{entity}` only fired `afterEntityCreate`, so the
  `entity.<slug>.before_create` filter could neither reshape nor reject a
  payload before the INSERT. The hook now runs after authorization and before
  the write; a thrown error rejects the create with `400
  BEFORE_CREATE_REJECTED` (or the 4xx `status` the error carries).

- **Generic entity handler no longer fails silently on bad list parameters,
  unknown body keys, or CHECK-constraint violations (#97).** Each of these used
  to return a plausible-looking wrong answer instead of an error the caller
  could act on:
  - `?search=` on an entity with none of `name`/`title`/`slug`/`content` → `400
    SEARCH_NOT_SUPPORTED` (was: every row, unfiltered).
  - A custom filter whose key is not an entity field (`?statuz=active`) → `400
    INVALID_FILTER` naming the key(s) (was: filter silently dropped). Legacy
    client params (`includeMeta`, `userId`, `sort`/`order`, `userFiltered`)
    stay accepted; `sort`/`order` now work as aliases of `sortBy`/`sortOrder`.
  - An invalid `?sortBy=` → `400 INVALID_SORT_FIELD` (was: silent default sort).
  - `?dateField=2026-01-15` on a `date`/`datetime` field matches the whole
    day (`>= day AND < day + 1`) instead of an equality that never matched a
    timestamp; values with a time component keep exact equality.
  - Create/update schemas from `generateEntitySchemas` are now `.strict()`:
    an unknown body key (`notes` for `note`) → `400 VALIDATION_ERROR` with an
    `unrecognized_keys` issue (was: silently stripped, `201`). Keys the handler
    consumes itself (`metas`, `userId`, `teamId`, taxonomy relation arrays,
    builder `blocks`/`settings`) are unaffected — and neither are read-only
    system columns (`id`, `createdAt`, `updatedAt`, and any field marked
    `api.readOnly`): the update schema strips them with `z.preprocess()`
    before the `.strict()` check runs, since the dashboard's edit form submits
    the full record it fetched, system fields included. Without this, saving
    any edit from the dashboard UI failed with a silent `400` (only logged to
    the console). `EntityFormWrapper` now surfaces a save error in the form
    instead of swallowing it.
  - PostgreSQL `23514` CHECK violations → `422 CHECK_CONSTRAINT_VIOLATION`
    with the constraint name; `23503` on create/update → `422
    FOREIGN_KEY_VIOLATION` (was: opaque `500`). `23505` → `409` and delete
    `23503` → `409` are unchanged.

## [0.1.0-beta.167]

### Security — RLS Enforcement Layer

This release closes a class of latent security gaps that only surface once the
app connects to Postgres as a **non-owner role** (the owner skips RLS). It makes
RLS real and is **backward-compatible**: installs that keep connecting as the
owner behave exactly as before. The "cutover" to real RLS is opt-in via env.

> **Upgrade note (existing databases):** several ORIGINAL migrations were edited
> in place (002/007/008/009/010/013/016/017). The migration runner tracks by
> filename, so already-migrated databases will NOT re-apply them — run
> `pnpm db:reset` to recreate the schema with the new policies.

### Added
- **Service connection (`DATABASE_SERVICE_URL`)**: a second DB pool that BYPASSES
  RLS for system operations (Better Auth login/verification, scheduler/processor,
  payment webhooks, superadmin bypass, privileged team/subscription bootstrap).
  `db.ts` routes by presence of `userId` (no userId → service); a `{ service: true }`
  option + `getServiceTransactionClient()` force the service pool for userId-bearing
  bootstraps. Falls back to `DATABASE_URL` when unset.
- **Runtime role migration `022_rls_runtime_roles.sql`**: creates the non-owner
  `nextspark_app` runtime role (member of `authenticated`, no `BYPASSRLS`), grants,
  default privileges for future objects, and an `anon` lockdown.
- **`MIGRATE_DATABASE_URL`**: run migrations/seeds as the table owner while the
  runtime connects as `nextspark_app`. Falls back to `DATABASE_URL`.
- **Direct-field `ownershipFilter`**: `ownershipFilter.linkedBy` is now optional
  (direct ownership via the entity's own column), and `linkedBy.softDelete?: boolean`
  makes the `deletedAt IS NULL` clause conditional (supports entities without a
  `deletedAt` column).

### Changed
- **LIST/READ permission enforcement**: the generic entity handler now checks
  session permissions on LIST and READ (previously only create/update/delete). A
  member without `entity.list`/`entity.read` gets 403. Admin bypass and API-key
  (scope-based) paths are unaffected.
- **Permission check fails CLOSED**: a thrown error during the session permission
  check now returns `500 PERMISSION_CHECK_FAILED` instead of allowing access.
- **Hardened default RLS policies**: `users`/`account`/`session`/`verification`
  (002), `subscriptions`/`billing_events` (013/016) and `scheduled_actions` (017)
  replace their permissive `USING (true)` / `WITH CHECK (true)` defaults with
  per-user / elevated-tier / service-only policies.
- **`team_role` is now `TEXT` (not a Postgres ENUM)**: themes extend team roles via
  config (`availableTeamRoles` + `permissions.config.ts`) without patching the DB.
  No privilege boundary is lost (RLS compares against explicit literals; unknown
  roles fail closed). Affects migrations 007/008/009/010.
- **Better Auth** connects via the service connection; `pgbouncer=true` is now only
  appended for pooler URLs.

### Added
- **Cross-subdomain session cookies** (`COOKIE_BASE_DOMAIN`): opt-in env var that
  scopes the auth session cookie to a shared base domain (e.g. `.example.com`) so
  the session is readable across sibling subdomains. Enables OAuth running on the
  apex to carry the session back to tenant subdomains in multi-tenant setups
  (social providers don't allow wildcard `redirect_uri`s, so OAuth can't run on
  the subdomain itself). Off by default — cookies stay host-scoped unless
  `COOKIE_BASE_DOMAIN` is set; pair it with a wildcard in `CORS_ADDITIONAL_ORIGINS`
  (e.g. `https://*.example.com`). See `docs/06-authentication/05-session-management.md`.

## [0.1.0-beta.147] - 2026-04-19

### Fixed
- **Root layout `NextIntlClientProvider` missing `locale` prop**: Dashboard pages crashed with
  `No intl context found. Have you configured the provider?` when the project had a different
  `next-intl` version (e.g. 4.8.x) than the one bundled with core (4.9.x). Each package version
  creates its own `IntlContext`, so the provider from one copy never matched consumers from the other.
  Fixed in `templates/app/layout.tsx` by explicitly passing `locale={locale}` and bumped core's
  `next-intl` dependency to `^4.9.1` to encourage deduplication.

### Migration notes (from <= 0.146)
Projects upgrading may need to deduplicate `next-intl`/`use-intl` in their monorepo. Add to the
root `package.json`:
```json
"pnpm": {
  "overrides": {
    "next-intl": "^4.9.1",
    "use-intl": "^4.9.1"
  }
}
```
Then `pnpm install` + restart dev. Run `pnpm nextspark sync:app --force` to refresh the
auto-generated `app/layout.tsx` with the `locale` prop fix.

## [0.1.0-beta.3] - 2025-01-04

### Added
- **ESLint Configuration**: Added `eslint.config.mjs` template for generated projects
- **Langchain Plugin Support**: Fixed demo theme installer to properly copy langchain plugin files
- **Starter Theme**: Minimal starter theme template for new projects
- **Pre-compiled UI CSS**: 120KB of pre-compiled Tailwind classes for UI components
- **Jest Mock Registries**: Comprehensive mock registries for unit testing
- **Web Crypto API Polyfills**: Full crypto support for API key tests

### Changed
- **Wizard Improvements**: Enhanced 9-step wizard with better validation
- **Package Structure**: Optimized exports for tree-shaking
- **Test Infrastructure**: Improved Jest configuration with proper module mappings

### Fixed
- **Demo Theme Installation**: Langchain plugin files now properly copied during demo installation
- **Cypress Support**: Fixed TypeScript support in Cypress tests via webpack preprocessor
- **DevKeyring Styles**: Fixed popover styles using pre-compiled CSS approach

## [0.1.0-beta.2] - 2025-01-03

### Added
- **Cypress Testing Framework**: Full E2E test infrastructure with @cypress/grep
- **Allure Reporting**: Integrated allure-cypress for test reports
- **Theme Templates**: Complete default and starter theme templates
- **Registry System**: Build-time registry generation for ultra-fast runtime

### Changed
- **Module Resolution**: Updated path mappings for ESM compatibility
- **Build Process**: Unified build script with tsup + tsc

### Fixed
- **Translation System**: All translation keys now properly resolved
- **Type Generation**: Fixed .d.ts generation for all exports

## [0.1.0-beta.1] - 2025-01-02

### Added
- **Initial Beta Release**: First public beta of @nextsparkjs/core
- **Interactive Wizard**: 9-step project generator with presets
- **Entity System**: Complete CRUD with dynamic API generation
- **Authentication**: Better Auth integration with social providers
- **Billing System**: Stripe integration with plans, features, and limits
- **Teams & Permissions**: Multi-tenant support with role-based access
- **i18n Support**: Multi-language with next-intl (6 languages)
- **UI Components**: 50+ shadcn/ui based components
- **DevTools**: Built-in development tools and API tester
- **Theme System**: Plugin-based theming architecture
- **Block Editor**: Drag-and-drop page builder

### Developer Experience
- **TypeScript First**: Full type safety across the framework
- **Hot Reload**: Fast refresh for theme development
- **CLI Tools**: `nextspark init`, `nextspark dev`, `nextspark build`
- **Testing Support**: Jest and Cypress configurations included

---

## Package Links

- **npm**: https://www.npmjs.com/package/@nextsparkjs/core
- **GitHub**: https://github.com/NextSpark-js/nextspark
- **Documentation**: https://nextspark.dev/docs
