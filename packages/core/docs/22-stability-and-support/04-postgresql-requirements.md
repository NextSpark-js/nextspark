# PostgreSQL requirements

> **Status:** written requirements for 1.0 (issue [#204](https://github.com/NextSpark-js/nextspark/issues/204), G0), checked against the core migrations and the database code at `0.1.0-beta.197`. NextSpark supports **standard PostgreSQL 15, 16, 17 and 18**. Neon, Supabase and Amazon RDS are **not verified**.

This page lists what a PostgreSQL server and its roles must provide for NextSpark to run. Version support and what CI tests are in [Support matrix](./02-support-matrix.md). Setup steps are in [Database setup](../02-getting-started/03-database-setup.md); the row-level security design is in [RLS policies](../10-backend/03-rls-policies.md).

## Server

- PostgreSQL 15, 16, 17 or 18. PostgreSQL 18 is verified in CI: the `verify (<template>, postgres 18)` jobs of `theme-migrations.yml` and the `migrate (<template>, postgres 18)` jobs of `generated-projects.yml` run every core migration and every template's migrations on it.
- SSL available, for any server that is not on the same host as the application. See [SSL](#ssl).
- The `pgcrypto` extension, which migration `001_better_auth_and_functions.sql` creates with `CREATE EXTENSION IF NOT EXISTS pgcrypto`. It is the only extension the core migrations create. On a managed server where extensions are installed by an administrator, create it before the first migration.

## Roles

Core's row-level security (RLS) is only evaluated for a role that does not own the tables and does not bypass RLS. NextSpark uses three connections:

| Connection | Variable | Role it needs |
| --- | --- | --- |
| Application | `DATABASE_URL` | A role that **does not own the tables and does not have `BYPASSRLS`**. Core creates `nextspark_app` for this (below). |
| Service | `DATABASE_SERVICE_URL` | A role that bypasses RLS, for work that has no user: sign-in, the scheduler, payment webhooks, the superadmin check. Unset, it falls back to `DATABASE_URL`. |
| Migration | `MIGRATE_DATABASE_URL` | The table **owner**. Unset, it falls back to `DATABASE_URL`. |

### The application role

Migration `022_rls_runtime_roles.sql` creates `nextspark_app` as `NOLOGIN` and a member of the `authenticated` role, so every policy written `TO authenticated` applies to it. It grants it `SELECT`, `INSERT`, `UPDATE` and `DELETE` on the tables of `public`, usage on sequences, and `EXECUTE` on functions, and sets default privileges so tables created later by the migration owner get the same grants. It creates no login and no `BYPASSRLS` role: both are deployment decisions.

A default Neon project's owner role has `BYPASSRLS`, so on Neon RLS is not evaluated on the owner path either; the `nextspark_app` switch below is the only setup that enforces it.

**Which role the application connects as is your choice, and the default is the owner.** A fresh project connects `DATABASE_URL` as the role that ran the migrations. That role owns the tables, so RLS is **not** evaluated on the application path. To enforce RLS, switch the application to `nextspark_app`:

1. Run the migrations, which create `nextspark_app` (`pnpm db:migrate`).
2. Give `nextspark_app` a login and a password: `ALTER ROLE nextspark_app LOGIN PASSWORD '...'`, run by the owner. Core never does this; the credential is a deployment secret.
3. Set `DATABASE_SERVICE_URL` to a role that bypasses RLS (a dedicated owner or `BYPASSRLS` role).
4. Set `DATABASE_URL` to the `nextspark_app` login.
5. Set `MIGRATE_DATABASE_URL` to the owner, so later migrations and seeds still run as the owner.
6. Run `nextspark doctor`: its "Row-level security" check passes once `DATABASE_URL` is a role that is subject to RLS (before the switch it warns, and a production server logs one `[rls]` warning at start). Check that sign-in works, that a plain member lists only their team's rows, and that cross-team access is denied.

Before 0.1.0-beta.198, creating a team and accepting an invitation as an existing user answered 500 on the `nextspark_app` connection. Both now write their rows on the service connection after the route's own checks, and migration `032_team_join_policies.sql` lets the creator read their new team and lets a user add only themself to a team: as the owner of a team they own that has no member yet, or with the role of a pending, unexpired invitation to their email. Run `pnpm db:migrate` before the cutover, and add both flows to the check in step 6.

Since migration `035_team_admin_metas_and_billing_policies.sql`, a team admin can edit the team on the `nextspark_app` connection (before it answered 404), and `subscriptions`, `usage`, `usage_events` and `billing_events` are written only on the service connection. Core's billing services, jobs and webhooks already write there; code of your own that writes these tables must too.

Since migration `036_developer_rls_bypass.sql`, `can_bypass_rls()` (and its alias `is_superadmin()`) is true for a developer as for a superadmin. Before it a developer bypassed RLS only as a member of the team flagged `metadata.systemAdmin`, so on the `nextspark_app` connection a developer outside that team saw only their own rows.

Since migration `037_users_role_guard.sql`, on the `nextspark_app` connection `users.role` changes only when the caller passes `can_bypass_rls()`, and never on the caller's own row. On the service connection nothing changes.

Since migration `039_team_members_admin_insert.sql`, a team's owner or admin adds another user to the team on the `nextspark_app` connection, with a role below their own (the owner any role but owner, an admin any role but owner and admin), the hierarchy `033` gives role changes and removals. A member or viewer adds nobody, and self-join stays as `032` left it. Core's own flows still add members on the service connection.

For each user request the application sets `app.user_id` with `SET LOCAL` inside a transaction (`queryWithRLS` in `src/lib/db.ts`); the policies read it through `get_auth_user_id()`. It does not use `SET ROLE`. A query with no user context runs on the service connection. The service connection is chosen by credential, never by request input. Set `DATABASE_SERVICE_URL` before pointing `DATABASE_URL` at `nextspark_app`: sign-in and the other system operations are meant to run on the service connection, and without it they fall back to the RLS-evaluated one.

### The migration role

The role in `MIGRATE_DATABASE_URL` (or `DATABASE_URL`, if unset) must be able to:

- create roles: migration `001` creates `authenticated`, `anon` and `service_role` when they do not exist, and migration `022` creates `nextspark_app` (`CREATE ROLE` needs the `CREATEROLE` attribute or a superuser; when `nextspark_app` already exists, a role without them still migrates: `022` skips `ALTER ROLE ... INHERIT`, `GRANT authenticated TO nextspark_app` and the role comment with a `Role setup: could not ...` warning, and a superuser runs those by hand);
- create tables, indexes, functions and triggers in `public`, enable row-level security, and create policies (the core migrations contain 81 `CREATE POLICY` statements);
- create the `pgcrypto` extension, or find it already installed;
- grant privileges on its own objects to `nextspark_app` and to `authenticated`, and grant `nextspark_app` to the migration role itself, so that role can `SET ROLE` to it in an isolation test. That last grant is attempted and skipped with a notice if it fails.

Where the provider already supplies `authenticated`, `anon` or `service_role` (Supabase does), the migrations do not recreate them. Migration `022` revokes every privilege `anon` has on the tables, sequences and functions of `public`, including default privileges.

## SSL

The connection policy is in `src/lib/db.ts` (the application) and `scripts/db/ssl-config.mjs` (the database scripts). It is set per connection string. The application's connections (`DATABASE_URL`, `DATABASE_SERVICE_URL`) follow the table below. The database scripts follow it too, except when the URL has no `sslmode` outside production (see below).

| `sslmode` in the URL | Behaviour |
| --- | --- |
| absent, `NODE_ENV=production` | SSL with certificate validation (`rejectUnauthorized: true`). |
| absent, any other `NODE_ENV` | No SSL. |
| `disable` | No SSL. In production, a warning is logged for any host other than loopback. |
| `require`, `prefer`, `allow` | SSL **without** certificate validation (`rejectUnauthorized: false`). |
| `verify-ca`, `verify-full` | SSL with certificate validation. |
| anything else | A warning, then the defaults above. |

Core removes `sslmode` from the connection string before it reaches the driver, so that the policy above, not the driver's reading of `sslmode`, decides. In particular `sslmode=require` does not validate the certificate here. Use `verify-full` for a remote server whose certificate chain your runtime trusts.

`require` therefore encrypts the connection but does not prove which server answered. To validate the certificate, put `sslmode=verify-full` (or `verify-ca`) in `DATABASE_URL` and `DATABASE_SERVICE_URL`; in production, a URL with no `sslmode` already does the same. The runtime must trust the server's certificate chain. A provider whose certificate is signed by a public authority needs nothing else. For a private or provider-specific CA, save its certificate as a PEM file and start the application with `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`, which adds it to Node's trusted authorities.

A production server without SSL, such as a local PostgreSQL used to test a production build, needs `sslmode=disable` in the URL. The database scripts (`db:migrate`, `db:seed` and the migration verifiers) follow the table above with one difference: a URL with no `sslmode` outside production asks for SSL **without** validating the certificate, and falls back to plain only if the server says it has no SSL. With `NODE_ENV=production`, in the environment or in the project `.env`, they do what the application does: SSL with certificate validation and no fallback. A production run against a server without SSL then stops with an error that names `sslmode=disable` and `sslmode=verify-full`.

`channel_binding=require` in the URL (Neon's default connection string carries it) is not applied: the `pg` driver only honours channel binding through its `enableChannelBinding` option, so the connection uses SCRAM without it and without a warning.

### Local Postgres

An exported `DATABASE_URL` (or `MIGRATE_DATABASE_URL`) beats the same variable in the project `.env`; the `.env` only fills what the environment leaves unset, and `--no-env-file` skips it. `db:migrate` prints the host and database it will migrate before it runs. See [Running Migrations](../10-backend/02-migrations.md#running-migrations).

## Poolers and timeouts

- **`DB_QUERY_TIMEOUT_MS`** (default `60000`, `0` disables) is applied by the client. It works behind any pooler.
- **`DB_STATEMENT_TIMEOUT_MS`** (default unset) also asks the server to cancel a statement. It is sent as a connection startup parameter, which a transaction pooler can reject (PgBouncer, for example) or drop without a word. Neon drops it: pooled or direct, its `statement_timeout` stays at 0 and the setting does nothing. Leave it unset behind a transaction pooler and rely on `DB_QUERY_TIMEOUT_MS`, or set the limit on the server with `ALTER ROLE <role> SET statement_timeout = ...`.
- **Transaction-mode poolers.** Every user request opens a transaction and sets `app.user_id` with `SET LOCAL`, which does not outlive the transaction. That is the shape a transaction-mode pooler needs, but no CI job runs through one. Point `MIGRATE_DATABASE_URL` and `DATABASE_SERVICE_URL` at a direct, non-pooler connection.
- **`MIGRATE_DATABASE_URL` and `db:seed`.** `pnpm db:seed` is `db:migrate` with the sample data, for development only. It uses the same runner, so it connects with `MIGRATE_DATABASE_URL` and falls back to `DATABASE_URL`. After the switch to `nextspark_app`, a `db:seed` without `MIGRATE_DATABASE_URL` connects as a role that cannot create tables.

See [Environment configuration](../02-getting-started/05-environment-configuration.md) for each variable.

## Providers

| Provider | Status |
| --- | --- |
| Self-hosted PostgreSQL 15, 16, 17 or 18 | Supported. |
| Neon | Not verified. |
| Supabase | Not verified. The migrations tolerate its pre-created roles, but no CI job runs against it. |
| Amazon RDS | Not verified. |

"Not verified" means no one has run the release gates against that provider for 1.0. A provider that meets the requirements above can work; a failure there is not a regression in a supported configuration.
