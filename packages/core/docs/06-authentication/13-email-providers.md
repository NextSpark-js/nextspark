# Email Providers

NextSpark sends the sign-in code, the verification and password-reset links and
team invitations through one email provider, chosen with `EMAIL_PROVIDER`:

| `EMAIL_PROVIDER` | Sends through | Needs |
|---|---|---|
| `console` | Prints the email in the server log (development only) | nothing |
| `resend` | [Resend](https://resend.com) | `RESEND_API_KEY`, `EMAIL_FROM` |
| `smtp` | Any SMTP server, through [nodemailer](https://nodemailer.com) | `SMTP_HOST`, `EMAIL_FROM`, the `nodemailer` package |
| `auto` (default) | `console` in development; Resend when `RESEND_API_KEY` is set, otherwise `console` | |

`auto` never selects `smtp`: choose it explicitly. A production build refuses
to start local sign-in on `console`.

## The sender

Every provider sends from the same address:

| Variable | Meaning |
|---|---|
| `EMAIL_FROM` | The sender address, for example `noreply@example.com`. Resend and SMTP need it; the console provider prints it |
| `EMAIL_FROM_NAME` | The display name, `App` when unset |

`RESEND_FROM_EMAIL` and `RESEND_FROM_NAME`, the names used before, still work:
each one is read when its `EMAIL_FROM` counterpart is unset or empty. When both
are set to different values, `EMAIL_FROM` wins and the server logs one warning
naming the two variables (never their values). Projects that only set
`RESEND_FROM_*` need no change; to move, rename the variables.

The readiness diagnostics name the variable that holds the problem:
`EMAIL_FROM_MISSING` when neither is set, `EMAIL_FROM_MALFORMED` or
`EMAIL_FROM_SANDBOX` for a bad `EMAIL_FROM`, and the `RESEND_FROM_EMAIL_*` codes
when the address comes from `RESEND_FROM_EMAIL`.

## When an email cannot be sent

A provider can refuse a send at runtime: an unverified sender, a rejected
password, a server that is down. What the caller sees depends on the email:

| Email | When the send fails |
|---|---|
| Sign-in code | The code request answers `503` with `{ "code": "EMAIL_SEND_FAILED" }`, and the login form shows a translated "could not send" message. The answer is the same for every address, known or not |
| Verification and password-reset codes | The request still succeeds: these go only to existing accounts, so an error would reveal which addresses have one |
| Password reset link | The request still succeeds, for the same reason |
| Verification link after sign-up | The sign-up succeeds; the user can ask for the email again |
| Verification link sent again | The request fails (Better Auth's own behavior) |
| Team invitation | The invitation is not created, and the invite request answers `503` with `EMAIL_SEND_FAILED` so the inviter can retry |
| Security notifications | Retried as a scheduled action |

The provider's own error text never reaches the client. The server log has it,
in a line such as `[auth] The sign-in code email could not be sent: ...` or
`Failed to send invitation email: ...`.

## SMTP

SMTP covers SendGrid, Mailgun, Amazon SES, Postmark and your own mail server.

### 1. Install nodemailer

`nodemailer` is an optional peer dependency of `@nextsparkjs/core`. Projects on
Resend or console never install it and never bundle it; only a project that
selects `smtp` adds it:

```bash
pnpm add nodemailer
```

It is loaded the first time an email is sent. If `EMAIL_PROVIDER=smtp` is set
and the package is missing, the send fails and the server log shows
"EMAIL_PROVIDER=smtp needs the nodemailer package, which is not installed or not
included in the deployment". The sign-in code request answers `EMAIL_SEND_FAILED`
(see [When an email cannot be sent](#when-an-email-cannot-be-sent)).

#### Standalone deployments

`output: 'standalone'` copies only the files Next.js can trace, and nodemailer is
loaded at runtime past the bundler, so it would be left out of
`.next/standalone/node_modules`. Projects created with the current template
already include it. For an existing project, or a custom `next.config`, add this
to `outputFileTracingIncludes` (keep the entries already there):

```js
outputFileTracingIncludes: {
  '/**/*': ['./node_modules/nodemailer/**/*'],
},
```

The glob matches nothing when nodemailer is not installed, so it is safe to keep
for projects that use Resend.

### 2. Set the variables

| Variable | Required | Meaning |
|---|---|---|
| `EMAIL_PROVIDER` | yes | `smtp` |
| `SMTP_HOST` | yes | The server's host name or IP address (IPv6 without brackets) |
| `SMTP_PORT` | no | An integer from 1 to 65535. Unset: `465` when `SMTP_SECURE=true`, otherwise `587` |
| `SMTP_SECURE` | no | `true` or `false` (exactly). `true` opens the connection with TLS, normally on port 465. `false` starts in plain text and upgrades with STARTTLS (required when `SMTP_USER` is set, except for `localhost`, `127.0.0.0/8` and `::1`), as on port 587. Unset: `true` when `SMTP_PORT=465`, otherwise `false` |
| `SMTP_USER` | no | The SMTP username. Set together with `SMTP_PASS`, or leave both unset for a server that does not authenticate |
| `SMTP_PASS` | no | The SMTP password |
| `EMAIL_FROM` | yes | The sender address, the same for every provider (see [The sender](#the-sender)). `EMAIL_FROM_NAME` is the display name |

The values are checked when the provider is selected. A wrong or incomplete set
fails with an error that names the variables and never prints their values, for
example `SMTP email provider is misconfigured: SMTP_HOST is missing; SMTP_PASS is missing.`

### 3. Examples

Host, port and security for the common services. The username and password are
the SMTP credentials each service issues in its dashboard: copy them into
`SMTP_USER` and `SMTP_PASS` from there. Check the service's own SMTP page for
the region or endpoint of your account.

```bash
# SendGrid
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false

# Mailgun (EU accounts: smtp.eu.mailgun.org)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false

# Amazon SES (the endpoint of the region your identity is verified in)
EMAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false

# Postmark
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false

# Your own server, TLS from the first byte
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.example.org
SMTP_PORT=465
SMTP_SECURE=true

# Your own server on a private network that does not authenticate:
# leave SMTP_USER and SMTP_PASS unset
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.example.org
SMTP_PORT=25
SMTP_SECURE=false
```

Every example also needs `EMAIL_FROM` (a sender the service has
verified) and, except the unauthenticated server, `SMTP_USER` and `SMTP_PASS`.

## Readiness

The auth readiness check (the production `nextspark build` check, the startup
log and the request gates) treats a complete SMTP configuration as working email
for the one-time code, verification, password recovery and invitations. A
complete configuration is `SMTP_HOST` and `EMAIL_FROM`, with `SMTP_PORT`
and `SMTP_SECURE` well formed when set and `SMTP_USER` / `SMTP_PASS` set
together. An incomplete one is reported with the variables by name, for example
`SMTP_HOST_MISSING` or `SMTP_PORT_MALFORMED`. If a host injects the variables only at runtime,
declare `NEXTSPARK_AUTH_RUNTIME_ONLY=email`: missing values are checked again
when the server starts, and a malformed one still fails the build.

The check looks at the variables only. It does not connect to the server and
does not check that `nodemailer` is installed.
