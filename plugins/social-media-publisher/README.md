# @nextsparkjs/plugin-social-media-publisher

Publish to Instagram Business accounts and Facebook Pages from a NextSpark project, with OAuth connection, encrypted token storage, token refresh and an audit log. It is entity-agnostic: your project supplies an adapter that says which of its entities uses a connected account.

> **Stability: experimental.** The first-party plugins are not part of the stable 1.0 surface and may change in a minor release without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## What it provides

| Piece | Where |
| --- | --- |
| OAuth connection | `GET /api/plugins/social-media-publisher/social/connect` starts it, `.../social/connect/callback` finishes it (Facebook Login, API `v21.0`) |
| Accounts | `GET .../social/accounts`, `POST .../social/assign`, `.../social/disconnect` |
| Publishing | `POST .../social/publish` |
| Audit log | The `audit-logs` entity (`/api/v1/audit-logs`), stored in `social_audit_logs` |
| Adapter | `SocialPlatformAdapter` and `registerSocialPlatformAdapter` in `lib/adapter` |
| Tables | `social_accounts` and `social_audit_logs`, with row-level security |

Routes accept a session or an API key with the `social:read` or `social:write` scope. Each route has a `docs.md` beside it.

## Installation

1. Add the package, enable it and tell Next.js to compile it:

   ```bash
   pnpm add @nextsparkjs/plugin-social-media-publisher
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-social-media-publisher'] })
   ```

   Add `'@nextsparkjs/plugin-social-media-publisher'` to `transpilePackages` in your Next config, next to `@nextsparkjs/core`: the plugin ships TypeScript source, and `nextspark prepare` stops and tells you if it is missing. `pnpm exec nextspark add:plugin @nextsparkjs/plugin-social-media-publisher` is an experimental helper that adds a plugin to a project.

2. Create a Facebook app and set its variables in your project's `.env` (the package's `.env.example` is the template):

   | Variable | Purpose |
   | --- | --- |
   | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | The Facebook app. `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are read as aliases |
   | `OAUTH_ENCRYPTION_KEY` | 32 bytes in hex that encrypt the stored tokens: `openssl rand -hex 32` |
   | `CRON_SECRET` | Read by the plugin for scheduled publishing requests; no route of the plugin uses it yet |

   Register `<your app URL>/api/plugins/social-media-publisher/social/connect/callback` as a valid OAuth redirect URI in the Facebook app. The [installation guide](./docs/01-getting-started/02-installation.md) walks through the Facebook app and its permissions.

3. Run `pnpm db:migrate`; if your app connects as `nextspark_app`, run it as the tables' owner (`MIGRATE_DATABASE_URL`). `GET /api/v1/audit-logs` checks the permissions `audit-logs.list` and `audit-logs.read`, which only your project's `config/permissions.config.ts` declares: add them under `entities` with the roles that may read the logs (see the [core changelog](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/CHANGELOG.md), 0.1.0-beta.203).

4. Write and register the adapter: [Adapter integration](./docs/03-advanced-usage/04-adapter-integration.md). The routes throw `No adapter registered` until the project registers one.

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.199`, with Next.js `~16.4.2` and React `^19.2.0`
- Peer dependencies: `lucide-react` `^0.539.0` and `zod` `^4.6.6`
- Node.js 22.x (22.14.0 or later) or 24.x
- Standard PostgreSQL 15 to 18 (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- A Facebook developer account and app; for Instagram, an Instagram Business account linked to a Facebook Page

## Documentation

- [Introduction](./docs/01-getting-started/01-introduction.md), [installation](./docs/01-getting-started/02-installation.md) and [configuration](./docs/01-getting-started/03-configuration.md)
- [OAuth integration](./docs/02-core-features/01-oauth-integration.md), [publishing](./docs/02-core-features/02-publishing.md), [token management](./docs/02-core-features/03-token-management.md) and [audit logging](./docs/02-core-features/04-audit-logging.md)
- [Adapter integration](./docs/03-advanced-usage/04-adapter-integration.md), [provider APIs](./docs/03-advanced-usage/01-provider-apis.md) and [custom integrations](./docs/03-advanced-usage/02-custom-integrations.md)
- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation

## License

MIT
