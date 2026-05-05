# Email templates

Drop a `.ts` file in this directory to override or add transactional email
templates for this theme. The build-time email registry picks files here
over the core defaults at the same slug, and any new slugs are additive.

## How discovery works

At build time, `pnpm dev` and `pnpm build` regenerate
`.nextspark/registries/email-registry.ts`. The registry first scans core's
defaults, then walks `themes/<NEXT_PUBLIC_ACTIVE_THEME>/emails/`. Theme files
with the same filename as a core default override the core file. Theme files
with new filenames are added to the registry as new slugs.

## File contract

Each file must have a default export with this shape:

```ts
export default async function <name>(
  data: <YourDataShape>,
  locale?: string,
): Promise<{ subject: string; html: string }>
```

`locale` is the BCP47 code (e.g. `'en'`, `'es'`); use it with
`getTranslations({ locale, namespace: 'email.<slug>' })` from `next-intl/server`
when you want translated copy. Core's defaults already do this for the four
slugs below.

## Core slugs you can override

| Slug                | Data type                  | Sent on                                   |
|---------------------|----------------------------|-------------------------------------------|
| `verify-email`      | `VerificationEmailData`    | Email/password signup (when enabled)      |
| `reset-password`    | `PasswordResetEmailData`   | Password reset request                    |
| `otp-verification`  | `OtpVerificationEmailData` | OTP-based sign-in / verification          |
| `team-invitation`   | `TeamInvitationEmailData`  | Adding a member to a team                 |

Import the data types from `@nextsparkjs/core/lib/email/types`.

## Adding new slugs

A theme can ship slugs core doesn't know about (e.g. `welcome.ts`,
`weekly-digest.ts`, `purchase-confirmation.ts`). After rebuild, they become
available as `EMAIL_REGISTRY['<slug>']` from
`@nextsparkjs/registries/email-registry` with full per-slug TypeScript
inference of the data argument — no `declare module` boilerplate.

## Falling back to core defaults

Delete a file from this directory to revert that slug to core's default on
the next build.

## Convenience helpers for the four core slugs

If you don't override, call sites in your project can keep using the typed
helpers exposed by core:

```ts
import {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendOtpVerificationEmail,
  sendTeamInvitationEmail,
} from '@nextsparkjs/core/lib/email/send'
```

These wrap `EMAIL_REGISTRY['<slug>']` and pick up your overrides automatically.
