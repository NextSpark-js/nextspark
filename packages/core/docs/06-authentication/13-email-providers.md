# Email Providers

NextSpark sends the sign-in code, the verification and password-reset links and
team invitations through one email provider, chosen with `EMAIL_PROVIDER`:

| `EMAIL_PROVIDER` | Sends through | Needs |
|---|---|---|
| `console` | Prints the email in the server log (development only) | nothing |
| `resend` | [Resend](https://resend.com) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| `smtp` | Any SMTP server, through [nodemailer](https://nodemailer.com) | `SMTP_HOST`, `RESEND_FROM_EMAIL`, the `nodemailer` package |
| `auto` (default) | `console` in development; Resend when a Resend variable is set, otherwise `console` | |

`auto` never selects `smtp`: choose it explicitly. A production build refuses
to start local sign-in on `console`.

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
and the package is missing, the send fails with
`EMAIL_PROVIDER=smtp needs the nodemailer package, which is not installed. Run `pnpm add nodemailer`.`
(in the server log; the caller sees its usual "failed to send" error).

### 2. Set the variables

| Variable | Required | Meaning |
|---|---|---|
| `EMAIL_PROVIDER` | yes | `smtp` |
| `SMTP_HOST` | yes | The server's host name |
| `SMTP_PORT` | no | An integer from 1 to 65535. Unset: `465` when `SMTP_SECURE=true`, otherwise `587` |
| `SMTP_SECURE` | no | `true` or `false` (exactly). `true` opens the connection with TLS, normally on port 465. `false` (default) starts in plain text and upgrades with STARTTLS when the server offers it, as it does on port 587 |
| `SMTP_USER` | no | The SMTP username. Set together with `SMTP_PASS`, or leave both unset for a server that does not authenticate |
| `SMTP_PASS` | no | The SMTP password |
| `RESEND_FROM_EMAIL` | yes | The sender address (also the name Resend uses). `RESEND_FROM_NAME` is the display name |

The sender setting keeps its `RESEND_` name: it is the one default-from setting
for every provider.

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

Every example also needs `RESEND_FROM_EMAIL` (a sender the service has
verified) and, except the unauthenticated server, `SMTP_USER` and `SMTP_PASS`.

## Readiness

The auth readiness check (the production `nextspark build` check, the startup
log and the request gates) treats a complete SMTP configuration as working email
for the one-time code, verification, password recovery and invitations. A
complete configuration is `SMTP_HOST` and `RESEND_FROM_EMAIL`, with `SMTP_PORT`
and `SMTP_SECURE` well formed when set and `SMTP_USER` / `SMTP_PASS` set
together. An incomplete one is reported with the variables by name, for example
`SMTP_HOST_MISSING` or `SMTP_PORT_MALFORMED`. If a host injects the variables only at runtime,
declare `NEXTSPARK_AUTH_RUNTIME_ONLY=email`: missing values are checked again
when the server starts, and a malformed one still fails the build.

The check looks at the variables only. It does not connect to the server and
does not check that `nodemailer` is installed.
