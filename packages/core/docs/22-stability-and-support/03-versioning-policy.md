# Stability and versioning policy

> **Status:** this is the policy recorded for 1.0 (issue [#204](https://github.com/NextSpark-js/nextspark/issues/204), G0). Until 1.0.0 is released, the `0.1.0-beta` line follows none of it: any beta can break anything.

NextSpark follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from 1.0.0. The packages `@nextsparkjs/core`, `@nextsparkjs/cli` and `create-nextspark-app` are released together. Which surfaces the rules cover is in [Stability](./01-stability); which of `@nextsparkjs/core`'s subpaths are public is in the Public API document (published separately).

## What each release may change

| Release | May | May not |
| --- | --- | --- |
| **Major** | Break the public API, configuration, project layout, or the flags and commands of the stable CLI. Raise the Node.js floor. Move to a new major of Next.js or React. Raise the PostgreSQL floor. Remove deprecated items. | |
| **Minor** | Add features. Deprecate items. Adopt a new minor of Next.js when it does not break the public API (with an upgrade note, a re-verified export table and the conformance suite). Change experimental surfaces and internal subpaths. | Break the public API, raise the Node.js or PostgreSQL floor, or change the project layout. |
| **Patch** | Fix bugs. Adopt patches of the supported Next.js minor. | Change documented behaviour, except for a security fix, and then the advisory says so. |

## Public and internal

A subpath of `@nextsparkjs/core` is public if at least one of these holds:

1. It is listed in the Public API document.
2. Code that a stable template copies into a project imports it.
3. It is a configuration contract: the `nextspark.config.ts` types, the entity config, `definePlugin`, `BlockConfig`, the billing config types, permissions and features.

The public contract also covers the root-first layout, the `templates/` and `api/` override conventions, the API namespaces, the documented `NEXTSPARK_*` variables, and the database schema as far as user data is concerned. The generated `src/app` is not public.

Everything else is internal, even if it resolves: `routes/*`, `templates/*`, `scripts/*`, `migrations/*`, the testing selectors, the devtools components, the billing gateways and webhooks, and `lib/mcp`. Internal subpaths may change in a minor and are versioned in lockstep with `@nextsparkjs/cli`. The package export map stays open until 2.0.

## Deprecation

A deprecation is announced in a minor, with a runtime or CLI notice and a changelog entry. The deprecated item is removed in the next major. There is **no minimum time period**: one minor of notice is enough.

A surface that is already deprecated when 1.0.0 ships, such as `@nextsparkjs/theme-*`, follows the same rule: it can be removed in 2.0.

## Experimental surfaces

Experimental surfaces carry no guarantee. They may change or be removed in a minor, with a changelog note, and without the deprecation notice above. Each experimental surface's documentation starts with a notice.

## Database migrations

Migrations are forward-only and atomic: the runner applies each file and records it in one transaction, and there is no down step. A file that starts with `-- nextspark:no-transaction` is the exception: it is recorded only after it has run. Core ships no such file. In a minor or patch, a migration is additive with respect to user data, except for a security fix. Apart from a security fix, dropping or rewriting user data happens only in a major.

## Security support

Security fixes ship in the latest 1.x minor. Older 1.x minors are not patched; upgrade to the latest minor. The `0.1.0-beta` releases are unsupported from 1.0.0.

## Release channels

| Channel | Version | npm tag |
| --- | --- | --- |
| Stable | `1.y.z` | `latest` |
| Release candidate | `1.0.0-rc.N` | `next` |

A release candidate becomes 1.0.0 only after seven days on the same candidate without a new blocker. Any code change produces `rc.N+1`. Pin the exact version when you install a release candidate, because pnpm 11 and later apply a one-day `minimumReleaseAge` to `@latest`.

## Upgrading from 0.x

There is **no legacy window in 1.x**. 1.0 does not read the old layout (`contents/themes/<theme>`, a committed `src/app`) at runtime. A 0.x project, from `0.1.0-beta.183` on, moves once with `nextspark migrate`; see [Upgrading 0.x projects](../17-updates/06-upgrade-0x-projects).

`nextspark migrate` stays available for 12 months after 1.0.0, or for the whole 1.x line, whichever ends first.

## Upgrading within 1.x

Follow the changelog. A minor that adopts a new Next.js minor says so under "Upgrading". Use `pnpm update-core` to move the `@nextsparkjs/*` packages; see [Core update command](../17-updates/01-update-core).
