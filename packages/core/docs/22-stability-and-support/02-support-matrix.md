# Support matrix

> **Status:** the "Supported for 1.0" column records the 1.0 decisions (issue [#204](https://github.com/NextSpark-js/nextspark/issues/204), G0). The "Tested in CI today" column describes the workflows in `.github/workflows` at `0.1.0-beta.197`. Where the two differ, the row says so.

A version outside this table is not supported. "Tested" means a CI job installs or runs that version; "supported" is the promise. The two are the same unless the row states otherwise.

## Runtime and framework

| Axis | Supported for 1.0 | Tested in CI today |
| --- | --- | --- |
| Node.js | 22.14 and later 22.x, and 24.x. `engines.node` is `>=22.14.0`. | 22.14.0 and 24 (unit and package suites, template builds). |
| Next.js | `~16.3.8`. This is the peer range of `@nextsparkjs/core`, and the generated host refuses 16.3.7 and earlier. | The version pinned by the repository, 16.3.8. |
| React | `^19.2.0` | 19.2.4. |
| Bundler | Turbopack. Webpack is deferred. | Project builds use the default bundler. The host conformance build also builds its fixture with webpack, which is not a support promise. |
| Operating system | Linux x64 and macOS arm64. Windows is not supported. Linux arm64 is untested. | `ubuntu-24.04` only. macOS is supported but has no CI job. |

A new minor of Next.js may be adopted in a minor of NextSpark if it does not break the public API. It ships with an upgrade note, a re-verified export table and a passing conformance suite. A new major of Next.js or React is a NextSpark major. See [Stability and versioning policy](./03-versioning-policy).

## Package managers

These apply to a **generated project**. The framework repository itself is pinned to pnpm 9 (`packageManager` in the root `package.json`), which is for contributing only.

| Package manager | Supported for 1.0 | Tested in CI today |
| --- | --- | --- |
| pnpm 10 | 10.34.6 and later 10.x | 10.34.6 on Node 22.14.0. |
| pnpm 11 | Yes | 11.28.4 on Node 24. |
| pnpm 12 | Yes | 12.9.1 on Node 24. |
| pnpm 12 on Node 22 | Only with an updated Corepack or a standalone pnpm. The Corepack bundled with Node 22 cannot install pnpm 12. | No. |
| pnpm 9 | Contributing to the framework repository only. | Yes, as the repository's own package manager. |
| npm, yarn, bun | Not supported. | No. |

The floor is 10.34.6 because pnpm 10.16 fails on a warm store cache with `ERR_PNPM_MISSING_TIME`. The pnpm cells are the matrix of the `pnpm` job in `generated-projects.yml`, which creates a project with each version and fails if a different pnpm ran.

## Database

| Axis | Supported for 1.0 | Tested in CI today |
| --- | --- | --- |
| PostgreSQL | Standard PostgreSQL 15, 16 and 17, with the [written requirements](./04-postgresql-requirements). PostgreSQL 18 is untested. | 15 for every build. 15, 16 and 17 for the migrations of every template, core migrations included (`theme-migrations.yml`; `generated-projects.yml` also migrates each created project on 16 and 17). |
| Neon, Supabase, Amazon RDS | **Not verified.** They may work if they meet the requirements. None is tested for 1.0 and none is promised. | No. |

## Deployment

| Axis | Supported for 1.0 | Tested in CI today |
| --- | --- | --- |
| `next start` | Stable. | Yes. |
| Standalone output | Stable if a Linux CI job for it exists before the release candidate. Otherwise experimental. | **No job today.** |
| Behind a TLS reverse proxy | Stable with the documented settings: `NEXTSPARK_CLIENT_IP_SOURCE` and `NEXTSPARK_TRUSTED_PROXY_HOPS` (see [Client address](../14-deployment/10-client-address)), and a proxy that sets `X-Forwarded-Proto`. The `X-Forwarded-Proto` requirement is not documented in a guide yet. | No. |
| Docker | No separate promise. A container running standalone output is standalone output. | No. |
| Vercel | Experimental. | No. |
| Legacy ISR (`cacheComponents` off) | Supported, not the default. | Yes, the `legacy-isr` job. |

## Mobile

| Axis | Supported for 1.0 | Tested in CI today |
| --- | --- | --- |
| Expo and React Native | Expo SDK 54 with React Native 0.81, and only in the web and mobile profile. Stable if a real sign-in from the app passes in an iOS or Android simulator before the release candidate; otherwise experimental. | `mobile.yml` checks the import boundary, the generated contracts, and type-checks and tests `apps/mobile` (Expo `^54.0.0`, React Native 0.81.5). It does not sign in from a simulator. |

The `@nextsparkjs/mobile` package declares wider peer ranges (`expo >=54.0.0`, `react-native >=0.75.0`). Only the SDK 54 and React Native 0.81 pair is supported.

## What the matrix does not promise

- A version listed as supported but not tested has no CI evidence; report a failure as a bug.
- Experimental surfaces in [Stability](./01-stability) are outside the matrix.
