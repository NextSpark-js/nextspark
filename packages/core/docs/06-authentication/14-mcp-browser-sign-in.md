# MCP Browser Sign-in (OAuth 2.1)

> **Experimental:** MCP browser sign-in is opt-in and not part of the stable 1.0 surface. It may change without a
> deprecation period. See [Known limits](#known-limits).

**OAuth 2.1 authorization server • One team per connection • Consent as the authority • Connected applications**

---

## Table of Contents

- [Overview](#overview)
- [API key or browser sign-in?](#api-key-or-browser-sign-in)
- [Turning it on](#turning-it-on)
- [What the host serves](#what-the-host-serves)
- [The flow a user sees](#the-flow-a-user-sees)
- [The model](#the-model)
- [Multi-tenant logic: one team per connection](#multi-tenant-logic-one-team-per-connection)
- [Permissions](#permissions)
- [Connected applications](#connected-applications)
- [Which applications may connect](#which-applications-may-connect)
- [Security model](#security-model)
- [Internal API](#internal-api)
- [Known limits](#known-limits)
- [Related documentation](#related-documentation)

---

## Overview

The [MCP server](../05-api/20-mcp-server.md) at `/api/mcp` exposes the project's entities as tools for an LLM client.
Out of the box it takes an API key. With MCP browser sign-in turned on, the app is also the **OAuth 2.1 authorization
server of its own MCP endpoint**: a client such as Claude or ChatGPT connects by sending the user to the app in a
browser, where the user signs in, chooses a team and approves the permissions. No API key is created or copied.

This is not the same thing as [OAuth providers](./03-oauth-providers.md). There the app is an OAuth *client* of
Google, GitHub, Microsoft or Apple, and the result is a browser session. Here the app is the authorization server
and the resource server, the client is an MCP application, and the result is an access token that is accepted at
`/api/mcp` and nowhere else.

Use it when the MCP client is an application a user connects from its own interface (a hosted assistant, a desktop
or mobile app) and the user should decide, per team, what it may do. Keep using an API key for a script, a server
integration or any client that cannot open a browser.

---

## API key or browser sign-in?

Both credentials are accepted at `/api/mcp` when the feature is on, never both in one request. They use the same
scope vocabulary (`<entity>:read|write|delete`) and the same entity handlers, and they differ in the following:

| | API key | Browser sign-in (OAuth) |
|---|---|---|
| **Where it is accepted** | `/api/v1/*` and `/api/mcp` | `/api/mcp` only |
| **Team binding** | Not bound to a team. Each request names one with `x-team-id`, or falls back to the user's default team | Bound to one team, chosen when the application is authorized. `x-team-id` cannot change it |
| **Expiry** | None by default; `expiresAt` is optional when the key is created | Access token: 10 minutes. The connection lasts while its refresh token is renewed |
| **Who can create one** | A signed-in user, in Settings > API Keys, with scopes the user's role allows | A signed-in user, by approving the application on the consent screen, with scopes the role allows in the chosen team |
| **What it may do over time** | The scopes it was created with | The consent, read on every request and cut down to what the role allows at that moment |
| **Revocation** | The user revokes the key. Another instance that has the key in its 5-minute cache can accept it until the entry expires | Disconnect in Settings > Security, a changed password, a suspension, and the events listed in [What ends a connection](#what-ends-a-connection). Refused on the next request on every instance |
| **Rate limit** | Tier `credential`: 1000 charges per minute per key | Tier `credential`: 1000 charges per minute per application and user |
| **Secret handling** | A long-lived secret the user copies into the client's configuration | Nothing is copied; the client holds short-lived tokens it obtained itself |
| **Audit** | `api_audit_log` rows carry `apiKeyId` | `apiKeyId` is null; the row carries `credential: 'oauth'`, the client id and the token id |

The two models are not unified. In particular an API key still acts in whichever team a request
names, and a connection never does.

---

## Turning it on

1. Opt in at build time, in `nextspark.config.ts`:

   ```ts
   import { defineConfig } from '@nextsparkjs/core/lib/config'

   export default defineConfig({
     features: { mcpOAuth: true },
   })
   ```

   The default is `false`. `nextspark prepare` generates the routes of the feature only when it is `true`; without
   it the host has none of them, the authorization server is not registered, and `/api/mcp` takes an API key only.

2. Apply the migrations. `migrations/049_oauth_provider.sql` adds the tables and the database rules described in
   [Security model](#security-model). The tables exist whether or not the feature is on; nothing reads or writes
   them while it is off.

3. Make sure the MCP endpoint itself is on: `MCP_ENABLED=true` in production (in development it is on unless
   `MCP_ENABLED=false`).

4. Check the two URLs the feature is built from: `NEXT_PUBLIC_APP_URL` (the MCP resource) and `BETTER_AUTH_URL`
   (the issuer). See [Resource and issuer](#resource-and-issuer).

Runtime switch: `MCP_OAUTH_ENABLED=false` turns browser sign-in off without a build. The OAuth pages then answer
`404`, the internal APIs answer `404`, the plugins are not registered, and `/api/mcp` goes back to API keys only.

The two functions that decide this are in `lib/mcp/oauth/config.ts`: `isMcpOAuthBuilt()` (the build flag) and
`isMcpOAuthEnabled()` (the build flag, `MCP_OAUTH_ENABLED` and `MCP_ENABLED` together).

Before going to production read
[Security Best Practices: MCP browser sign-in](./07-security-best-practices.md#mcp-browser-sign-in): the framework
does not check any of those settings for you.

---

## What the host serves

| URL | What it is |
|---|---|
| `/.well-known/oauth-protected-resource/api/mcp` | The resource's metadata (RFC 9728). The `401` of `/api/mcp` names it in `WWW-Authenticate` |
| `/.well-known/oauth-authorization-server/api/auth`, `/api/auth/.well-known/openid-configuration` | The authorization server's metadata (RFC 8414) |
| `/api/auth/oauth2/authorize`, `/api/auth/oauth2/token`, `/api/auth/oauth2/revoke`, `/api/auth/oauth2/userinfo`, `/api/auth/oauth2/consent`, `/api/auth/oauth2/continue` | Better Auth's OAuth endpoints |
| `/api/auth/jwks` | The public half of the signing keys |
| `/oauth/select-team`, `/oauth/consent` | The team picker and the consent screen (`routes/(auth)/oauth/`) |
| `/api/internal/oauth-team`, `/api/internal/oauth-connections` | The APIs behind those two pages and the settings card. Session only. See [Internal API](#internal-api) |

`packages/core/src/routes/manifest.json` lists the routes core adds, and the registry build
(`OPT_IN_CORE_ROUTES.mcpOAuth` in `scripts/build/registry/host/features.mjs`) leaves them out unless the feature is
on. `oauth` and `.well-known` are reserved slugs, so a project's content cannot take those paths.

Under a Next.js `basePath` the discovery documents are served inside it, and the challenge of `/api/mcp` points
there.

---

## The flow a user sees

1. **The user adds the server in the application**, giving it the URL of `/api/mcp`. The application calls it with
   no credential and gets a `401` whose `WWW-Authenticate` header names the resource metadata and the scopes to ask
   for. From the metadata it finds the authorization server.
2. **Sign in.** The application opens the app's authorization endpoint in a browser. A user with no session lands on
   the login page and signs in with any method the project offers. After a password or a one-time code the
   authorization goes on from that page; after Google or a sign-in link, which come back somewhere else, the browser
   is sent to the authorization endpoint again with the application's original request (`useAuth`,
   `lib/mcp/oauth/sign-in-continuation.ts`). Nothing is trusted from that URL: the server validates the request from
   scratch.
3. **Team picker.** A user who belongs to several teams chooses one on `/oauth/select-team`. A user in one team does
   not see this step. A user in no team cannot connect.
4. **Consent.** `/oauth/consent` names the application and its host and lists the permissions, one row per entity
   with read, write and delete. The user ticks what to grant and accepts, or denies.
5. **Connected.** The browser returns to the application, which exchanges its code for tokens and starts calling
   tools. The connection now appears in Settings > Security > Connected applications.

---

## The model

### Plugins

`mcpOAuthPlugins()` (`lib/mcp/oauth/plugins.ts`) adds four Better Auth plugins to `lib/auth.ts`, and none when the
feature is off:

| Plugin | From | Role |
|---|---|---|
| `jwt()` | `better-auth/plugins` | Signs the access tokens. EdDSA keys, stored in the table `jwks` |
| `mcp()` | `@better-auth/mcp` | The OAuth provider, bound to the MCP resource |
| `cimd()` | `@better-auth/cimd` | Lets a client identify itself with a Client ID Metadata Document |
| `consentWithinRolePlugin()` | `lib/mcp/oauth/consent-plugin.ts` | The project's own: holds a consent to the user's role and applies the list of accepted applications |

### Clients

A client identifies itself with a **Client ID Metadata Document**: its client id is an `https` URL where it
publishes its name and redirect URIs. This is how Claude and ChatGPT register. Unauthenticated dynamic client
registration is closed. A client set to skip consent (`skipConsent`) is refused (`refuseConsentSkippingClient`): the
consent is where the user chooses the permissions and the row every refresh token is held to.

### Grants

Authorization code with PKCE (S256), and refresh token. There is no client credentials grant: a token for
`/api/mcp` is always a user's in a team.

### Tokens

- **Access tokens** are JWTs issued for the resource `/api/mcp` and valid for **10 minutes**. They carry the user
  (`sub`), the client (`azp`), the granted scopes, the team (`team_id`) and a revocation number (`rev`).
- **Refresh tokens rotate**: each renewal replaces the token. A replaced token presented again is treated by Better
  Auth as stolen and ends every connection of that client for the user.

### Resource and issuer

- The **resource** is a URL of the app: `NEXT_PUBLIC_APP_URL` plus `/api/mcp` (`mcpResourceUrl()`). Tokens are
  issued for it, and it is the only audience `/api/mcp` accepts.
- The **issuer** is where Better Auth is served: `BETTER_AUTH_URL`, with its own path when it has one, otherwise
  its origin plus `/api/auth` (`mcpOAuthIssuer()`).

The two may be different origins. Both work under a Next.js `basePath`.

### Signing key rotation

The signing key is replaced every 30 days (`SIGNING_KEY_ROTATION_SECONDS`). The key it replaces stays published for
Better Auth's 30-day grace period, far longer than a token it signed can live, so no token fails over a rotation. A
key that was created before rotation was configured has no expiry and does not rotate by itself.

---

## Multi-tenant logic: one team per connection

A connection is **one application acting for one user in one team**: the triple (user, client, team).

- **The team is part of the grant.** It is stored as the consent's `referenceId` and travels in the access token as
  the `team_id` claim. A request cannot change it: the `x-team-id` header is ignored on this path, and the tools
  call the entity handlers with the team of the token.
- **How the team is chosen.** A user in one team gets that team. A user in several picks one on
  `/oauth/select-team` (`lib/mcp/oauth/team-selection.ts`).
- **How the choice is bound.** It is stored per browser session and per authorization request, identified by the
  request's PKCE challenge, so two authorizations open at once in one browser keep their own teams. It is written
  once: choosing a different team for the same authorization is refused with `409 TEAM_ALREADY_CHOSEN`, and the user
  starts again from the application. It is checked against the user's memberships when it is written and again when
  it is read, and it is only valid for 15 minutes.
- **Two teams means two connections.** To use an application in two teams the user connects it twice, once per
  team. Each connection has its own consent, its own permissions and its own entry in the settings card.
- **What is read again on every request.** The resource server (`principalFromClaims` in
  `lib/mcp/oauth/resource-server.ts`) does not trust what the token said ten minutes ago. On each request it reads:
  - the user: a suspended or deleted account is refused;
  - the team and the membership: a deleted team, or a user removed from it, is refused;
  - the list of accepted applications as it is now;
  - the revocations recorded since the token was issued;
  - the consent of the connection;
  - the user's role in the team, to cut the scopes down to what it allows now.

---

## Permissions

### Scopes

The scopes are the entity scopes API keys use: `<entity>:read`, `<entity>:write`, `<entity>:delete`. Wildcards are
never offered or accepted. `offline_access` and the identity scopes (`openid`, `profile`, `email`) are part of
sign-in and are not MCP permissions.

**Two lists: what is accepted and what is active.**

- **Accepted** (`mcpOAuthAcceptedScopes()` in `lib/mcp/oauth/scopes.ts`): every entity scope a team role can hold.
  It is the vocabulary of the authorization server and it does not change when a tool is added or removed. A scope
  that never was in it is refused with `invalid_scope`.
- **Active** (`mcpOAuthResourceScopes()`): of the accepted scopes, the ones some tool of the MCP server needs
  (`mcpToolScopes()` in `lib/mcp/oauth/tool-scopes.ts`). An entity kept out of MCP (`patterns`, by default) and an
  operation an entity's `mcp.ts` excludes have no tool, and so no active scope.

Everything a user or a client sees or gets goes by the active list:

- what the server publishes as `scopes_supported`, in the protected resource metadata and in the authorization
  server metadata (`advertisedMetadata.scopes_supported` of the provider);
- what the `401` challenge asks for and what a step-up challenge names;
- what the consent screen shows (`offered` of `/api/internal/oauth-team`) and lets the user tick (`allowed`);
- what a consent can hold: both endpoints that write one, `/oauth2/consent` and `/oauth2/update-consent`, are cut
  down to it;
- what a token issued for the resource carries (`allowedScopes` of the resource): an access token and the refresh
  token issued with it never hold a scope that is not active.

None of it depends on what a client chooses to request. Claude asks for the scopes of the `401` challenge; ChatGPT
asks for everything in `scopes_supported`, and keeps asking for the list of the day its connector was created;
both are offered the same rows. The list is computed from the entity
registry and the `entities/<slug>/mcp.ts` overrides, the registries the default `/api/mcp` route builds its tools
from, with the function the engine itself uses to decide which entities and operations get a tool
(`exposedEntities` in `lib/mcp/exposure.ts`). For hand-written tools the list takes what the project declares as
plain data: `extraToolScopes` next to `extraTools` in an entity's `mcp.ts`. No tool factory is run to find it out.
A hand-written tool that needs a scope no generated tool uses and no `extraToolScopes` declares cannot be granted
it by any connection; the engine warns about it when it builds the tool. See
[Scopes a tool needs](../05-api/20-mcp-server.md#scopes-a-tool-needs).

**With sign-in enabled, every `mcp.ts` is loaded while the authorization server is configured.** Reading the
declarations imports the overrides, and importing a module evaluates its module scope. An `mcp.ts` must not read
`lib/auth` there (directly or through a helper that does): `auth` is not initialized yet at that point and every
auth route would fail to load. Do that work inside the tool handlers. With sign-in off the overrides are loaded
by `/api/mcp` only, as before.

**Outside the app.** `nextspark worker` runs core's built modules without a bundler, and the overrides cannot be
loaded late there. When a handler of the project imports `lib/auth` in that process, the list is computed without
the overrides and a warning says so: it is the scopes of the generated tools by default, not what the app serves
(an operation an override excludes is back, a declared `extraToolScopes` is missing). Sign-in is not served from
the worker, so nothing is published or granted from that list. Only the missing `require` is tolerated: an
`mcp.ts` that fails to load for any other reason still fails loudly.

**A declaration is trusted.** A scope left in `extraToolScopes` after its tool is gone is published and offered
again, and nothing warns about it: remove the scope with the tool. A scope no team role can hold (a typo such as
`task:read`) is dropped from the list without a message.

The `401` challenge tells a connecting client to ask for `offline_access` plus every scope of the resource
(`mcpOAuthDefaultScopes`). Asking is not getting: the request carries them all because a consent can only take
scopes away from what was asked.

**When a scope is retired.** Excluding an operation later (or an entity) takes its scope out of the active list
and leaves it in the accepted one. Nobody is cut off:

- An application that kept an older list (ChatGPT stores the scopes it discovered with the connector) can still
  authorize. The scope is accepted when asked for and it is not granted: the consent screen does not show it, and
  the token response names the scopes that were granted, as RFC 6749 section 3.3 has it.
- A connection that holds the scope keeps renewing. The token it gets no longer carries it, and neither does the
  refresh token that replaces the old one, so the connection sheds it at its next renewal.
- Connected applications shows a connection with its active permissions only.

The consent of an earlier connection is not rewritten when the list changes: it still names the scope until the
user edits the permissions or connects again. That matters if a tool that needs exactly that scope comes back
later. A connection that never renewed while the scope was retired still has it in its tokens and can use the
tool at once. One that renewed lost it from its tokens, so the tool does not work for it by itself; but since the
consent still names the scope, its next authorization or step-up gets it back without a consent screen.
Retiring a tool is not a revocation. To take a permission away for good, narrow the connections
(`narrowConnection`, which records the revocation and cuts the live tokens), and do not give a scope name a
wider meaning than it had.

### The consent screen and its defaults

`components/auth/OAuthConsent.tsx` shows one row per entity with read, write and delete.

- **First connection:** read and write come ticked, delete does not (`isPreselectedScope`). Permission to delete is
  always something the user chose.
- **A permission the user's role cannot hold in that team** is shown disabled and cannot be ticked.
- **An application already connected to that team** comes with exactly what it holds ticked and nothing else, so
  accepting the screen as it is takes nothing away and adds nothing.

Only what stays ticked is granted.

### The server-side bound to the role

The browser is not trusted with that decision. `consentWithinRolePlugin` rewrites the scopes of two Better Auth
endpoints before they run:

- `/oauth2/consent`: the granted scopes become *requested* ∩ *ticked by the user* ∩ *active* ∩ *what the role can
  hold in the chosen team*.
- `/oauth2/update-consent`, which lets a signed-in user rewrite the scopes of a consent directly: the same bound,
  for the team of that consent.

Without this, a request written by hand could put a scope the role does not have into the grant. The resource
server would still refuse to act on it, but the grant, the token and the list of connected applications would name a
permission the user never had.

### The consent is the authority

What a connection may do is its consent row, and it is read on every request:

```text
effective scopes = scopes in the token ∩ scopes in the consent
                   then cut down to what the user's role in the team allows now
```

A token therefore counts for what it holds and the consent still has. Narrowing the consent takes effect on the
next request, and a connection with no consent row is refused with `401`, whatever its token says.

### Step-up

A call that needs a scope the connection was not granted is answered `403` before anything runs, with an RFC 6750
`insufficient_scope` challenge. The `scope` of the challenge is the active scopes the connection has plus the
active scopes that are missing (`mcpOAuthStepUpScopes`), so a client that authorizes again with exactly that list
loses nothing that does something. A retired scope the connection still holds is not named. A batch is refused
whole when any of its calls lacks a scope. The refused calls are written to the audit log.

A scope that *was* granted and that the user's role no longer allows is a different case: the tool refuses it, with
no challenge, because asking again would not help.

Which scopes a tool needs comes from `engine.requiredScopesFor(toolName)`; see
[MCP Server: scopes a tool needs](../05-api/20-mcp-server.md#scopes-a-tool-needs).

---

## Connected applications

**Settings > Security > Connected applications** (`components/settings/ConnectedApps.tsx`) is rendered only in a
project built with the feature. It lists the user's connections: application, host, team, permissions per entity,
when it was connected and when it last renewed. A connection is listed while it has a refresh token that is neither
revoked nor expired.

### Edit permissions

Editing **only takes permissions away** (`narrowConnection` in `lib/mcp/oauth/connection-store.ts`,
`PATCH /api/internal/oauth-connections`). The application stays connected with what is left, and what it had been
issued before is refused at once. Keeping nothing is refused with `400 NO_PERMISSION_LEFT`: that is disconnecting.
Giving an application more is done from the application, which opens the consent screen.

### Disconnect

`DELETE /api/internal/oauth-connections` ends the connection at once: its consent and its refresh tokens are
removed, and the access tokens already issued are refused on the next request. To use the application again the
user connects and authorizes it again.

### Managing other members' connections

A connection acts with its user's role in the team, so whoever manages a team's integrations needs to see which
applications reach its data. That is the team permission **`settings.integrations`** (`MANAGE_CONNECTIONS` in
`lib/mcp/oauth/connections.ts`), held by `owner` and `admin` by default.

A member who holds it sees the other members' connections to that team in the same card and **can end them, not
edit them**.

It is a team permission and not a check on a role name because it is decided by `hasTeamPermission`, like every
other team permission: a project's own roles can be given it, and `teams.appRoleBypass` counts. When a manager ends
a connection, the manager's team role and app role are read and locked in the same transaction that ends it
(`disconnectAs`), so a role taken away at that moment is either seen or waits. The answer for a team the caller does
not manage is the same `404` as for a connection that is not there.

---

## Which applications may connect

By default **any application with a valid metadata document can start a sign-in**, and the user decides on the
consent screen, which names the application and its host.

A project that wants to decide itself lists the hosts it accepts in `config/app.config.ts`:

```ts
export const APP_CONFIG_OVERRIDES = {
  mcp: { oauth: { allowedClientHosts: ['claude.ai', 'chatgpt.com'] } },
}
```

`*.example.com` accepts the subdomains of a host. The rule is in `lib/mcp/oauth/allowed-clients.ts`.

**With a list, an application is accepted only when its client id is an `https` URL, with no credentials in it, on
one of the listed hosts.** The list is applied in four places:

1. Before the application's metadata document is fetched.
2. When the application asks for authorization.
3. At `/oauth2/token` and `/oauth2/userinfo`: the request must name at least one client, and every client it names
   must be accepted. Naming an accepted client beside the real one gains nothing.
4. On every request to `/api/mcp`, so a token issued before the list changed stops being accepted.

**Exact semantics of the value:**

| `allowedClientHosts` | Result |
|---|---|
| absent (`undefined`) | Open: every application may connect |
| `[]` | Open: every application may connect |
| a list with at least one usable host | Closed to every application not on a listed host |
| anything else that names no usable host: `null`, a string, `['https//claude.ai']` | **Closed to every application** |

An unusable list closes the server instead of opening it: a typo in a security setting must not mean "anyone". The
unusable entries are logged once (`[mcp:oauth] mcp.oauth.allowedClientHosts has entries that name no host...`). In a
list that mixes usable and unusable entries, the unusable ones are ignored and logged, and only the usable hosts may
connect.

With a list, `/oauth2/userinfo` answers only to JWT access tokens: an opaque token does not say which application it
was issued to.

---

## Security model

Each guarantee, and what enforces it.

| Guarantee | Enforced by |
|---|---|
| A token is accepted only if it was issued by this server, for this resource, and has not expired | `requireMcpAuth` (`@better-auth/mcp`) verifies signature, issuer, audience and expiry in process, in `handleOAuthMcpRequest` |
| The access token is never presented to another route | The MCP endpoint verifies it once and attaches the resulting principal to the request object it builds for each tool (`lib/api/auth/in-process-principal.ts`, a `WeakMap` keyed by object identity). Nothing sent over HTTP can set it |
| A connection acts in one team | The `team_id` claim, set from the consent's `referenceId`; `x-team-id` is not read on this path |
| A connection never holds more than the user's role | `consentWithinRolePlugin` when the consent is written; `validateScopesForUser` on every request |
| The consent decides what a connection may do | The consent row is read on every request; the database rules below hold every refresh token to it |
| A connection that was ended stays ended, at once, on every instance | The revocation number (`oauthRevocation` and the `rev` claim), and the removal of the consent and the refresh tokens |
| Only accepted applications connect | `allowedClientHosts`, applied in four places |
| A suspended account authorizes nothing and gets no token | Checked at authorization (read from the database, since the session's copy of the user can be older than the suspension), at every token issuance and on every request; a suspension also ends every connection of the user |
| The authorization server's tables are not readable through a user's database role | Service-only RLS policies on every OAuth table |
| What one connection may send is limited | The `credential` rate limit tier, shared between instances only with Redis configured |
| What an application did, and what it was refused for lack of a permission, is recorded | `api_audit_log`, best effort: a call rejected before its handler for malformed arguments leaves no row, and a failed audit write does not stop the call |

### Rules that live in the database (migration 049)

These rules are **triggers**, not application code, because Better Auth changes these rows from several endpoints
and in separate statements. A rule written in the app would hold only for the paths the app wrote; a trigger holds
for every path, Better Auth's own endpoints included, and on every instance.

| Trigger | Rule |
|---|---|
| `oauth_refresh_token_requires_consent` (BEFORE INSERT on `oauthRefreshToken`) | A refresh token with a team is written only while the connection's consent exists, and holding no more than the consent. It takes `FOR SHARE` on the consent row; with no consent the insert fails with "oauth connection ended". A token that would hold more is cut down with `oauth_scopes_within` |
| `oauth_consent_narrowed` (AFTER UPDATE OF `scopes` on `oauthConsent`) | A consent that loses a scope records a revocation and cuts the connection's live refresh tokens down to it |
| `oauth_consent_removed` (AFTER DELETE on `oauthConsent`) | Removing a consent, by whatever means, records a revocation and removes the connection's refresh tokens |
| `oauth_refresh_token_revoked`, `oauth_refresh_token_deleted` | A live refresh token revoked or deleted records a revocation of that connection. A rotation is not one |
| `oauth_revoke_on_password_change` (on `account`), `oauth_revoke_on_suspension` (on `users`) | End every connection of the user |

The share lock in the first rule is what makes a renewal and a disconnection exclude each other. A renewal in flight
either writes its new token before the consent goes, and the token is removed with the rest, or finds no consent and
is refused. No race leaves a live token behind for a connection that was ended. The same lock orders a renewal
against a narrowing: the new token holds no more than the consent it finds.

Also in the migration:

- The unique index `uq_oauth_consent_connection` on `oauthConsent("userId", "clientId", "referenceId")`: one consent
  per connection.
- Every OAuth table, `jwks` and `oauthRevocation` included, has RLS enabled with a service-only policy. `jwks` holds
  the signing private key and the token tables hold credentials.

Everything is in the single file `049_oauth_provider.sql`: the feature has no other migration and changes no
existing one. Once it is released, changes go in new migrations.

### The revocation number

An access token is a signed JWT that lives ten minutes, and a revocation must not wait for that. Every event that
ends or narrows a connection writes a numbered row in `oauthRevocation`: with the client and the team when one
connection is affected, with neither when all of the user's are.

A token is issued carrying the number of the user's newest revocation (the `rev` claim, `latestRevocation`). It is
refused once a newer row covers its client and team, or all of the user's connections (`isRevokedSince` in
`lib/mcp/oauth/revocation.ts`). **No clock is compared**, so the check holds across instances with different clocks.
Another client's connection, and the same client's connection to another team, are not touched. A token whose `rev`
claim is missing or malformed is refused.

### What ends a connection

- **Disconnect** in Settings > Security, by the user or by a member who manages the team's integrations.
- **A changed password** (a change, a reset, or an administrator's write) and **a suspended account**: every
  connection of the user ends, and every application asks for consent again.
- **A refresh token presented again after it was replaced:** Better Auth ends every connection of that client for
  the user.
- **The client revoking its token** at `/oauth2/revoke`.
- **Better Auth's own `/oauth2/delete-consent`.**

A removed consent ends its connection for good: nothing it had been issued comes back when the same application is
authorized again.

The following do not end a connection but stop it from working, on the next request: the user removed from the
team, the team deleted, the application dropped from `allowedClientHosts`.

**Signing out of the browser does not disconnect an application.**

### Audit

Every tool call that reaches its handler is recorded in `api_audit_log`, best effort, with the endpoint
`mcp:<tool>` and the real status. A call refused for a missing scope is recorded too, with status `403`. An OAuth call has `apiKeyId` null and
carries `credential: 'oauth'`, `oauthClientId` and `oauthTokenId` in `requestBody`. Argument values whose key names a
secret are replaced by `[redacted]`. The full contract is in
[MCP Server: audit trail](../05-api/20-mcp-server.md#audit-trail).

### Rate limit

A connection has 1000 charges per minute against the built-in tier `credential`, which is also what an API key
gets. A request such as `ping` or `tools/list` is one charge; a generated entity tool is two, the MCP request and
the API handler it calls, so about 500 such calls fit in a minute. It is counted per application and user. The count is shared between instances only when Redis is configured; see
[Rate Limiting: the per-credential limit](../05-api/07-rate-limiting.md#the-per-credential-limit-the-credential-tier).

### Housekeeping

Better Auth never deletes what has expired. `lib/mcp/oauth/purge.ts` does: `purgeExpiredOAuthIfDue()` runs where
tokens are issued, at most once an hour per process, and never fails the token being issued. Each run removes, a day
after expiry and at most 2000 rows of each kind (`PURGE_BATCH`, with `FOR UPDATE SKIP LOCKED` so several instances
do not wait for each other):

- access token rows;
- refresh tokens, by their own expiry only. A replaced or revoked token is kept until then: the authorization server
  needs that row to recognise a token presented again;
- client assertions;
- team selections;
- old revocations (a user's newest always stays: it is the number the next token carries);
- signing keys, 31 days after they expired.

There is no job to set up, and this is not a Scheduled Action. A project that wants its own schedule can call
`purgeExpiredOAuth()`.

---

## Internal API

Both routes take the browser session only, and answer `404` while the feature is off. They are the app's own
screens' APIs, not a public surface.

### `/api/internal/oauth-team`

| Method | Purpose |
|---|---|
| `GET ?authorization=<PKCE challenge>&client_id=<client id>` | `data`: the teams the user can connect. `selected`: the team chosen for that authorization, or `null`. `allowed`: of the active scopes, the ones the user's role can hold in the selected team. `offered`: the active scopes, whatever the role; the screen does not show a permission the application asks for that is not among them. `granted`: what the application already holds in that team, or `null` when it is not connected to it |
| `POST { teamId, authorization }` | Chooses the team. `403 NOT_A_MEMBER` when the user is not a member; `409 TEAM_ALREADY_CHOSEN` when another team was already chosen for that authorization |

### `/api/internal/oauth-connections`

| Method | Purpose |
|---|---|
| `GET` | `data`: the user's own connections. `managed`: other members' connections to the teams whose integrations the user manages |
| `PATCH { clientId, teamId, scopes }` | Narrows one of the user's own connections to `scopes`, the entity permissions it keeps. Answers `changed: true` or `false`. `400 NO_PERMISSION_LEFT` when nothing would be left; `404` when there is no such connection |
| `DELETE { clientId, teamId, userId? }` | Ends the user's own connection, or with `userId` another member's in a team the caller manages. `404` when there was nothing to end or the caller may not |

---

## Known limits

- **No production gate.** The feature does not refuse to start when the database connection owns the tables, in
  which case RLS has no effect, or when there is no Redis, in which case the rate limit is per process. Both are the
  operator's to check; see [Security Best Practices](./07-security-best-practices.md#mcp-browser-sign-in).
- **Run against Claude** (web, desktop and mobile) **and ChatGPT** (web), with their real hosted clients. Other
  clients have not been run. What was seen with ChatGPT, which differs from Claude: it authenticates itself to
  the token endpoint with a signed assertion (`private_key_jwt`) instead of being a public client; it asks for
  every scope in `scopes_supported` and keeps asking for the list of the day its connector was created; it
  renews its token before almost every call; and it presents a `403` for a missing scope as "the connection has
  expired, reconnect". Completing that step-up (ticking the missing permission and repeating the call) has been
  run with Claude and not with ChatGPT.
- **A deployment that changes the active list, and a renewal retried across it.** A client that renews a token,
  loses the answer and retries within 30 seconds gets the first answer again. If the deployment changed the active
  list between the two, the retry no longer matches and is refused with `invalid_grant`; the client must
  authorize again. Whether it does so by itself depends on the client and has not been verified across this
  race. The window is the 30 seconds after a renewal that straddles the deployment.
- **A deployment that changes the active list, while instances of two versions run.** The policy that cuts tokens
  down to the active scopes is a row in the database (`oauthResource`), and every instance writes it from its own
  configuration when it starts (`resourceSeedMode: 'merge'`). Nothing compares versions: the last instance to start
  wins. In a gradual deployment, an instance of the earlier version that starts after one of the new version writes
  the earlier list back, and tokens are cut to that list until an instance of the new version starts again. What
  the consent screen offers and what a consent can hold do not read that row: each instance computes them from
  its own version. Deploy
  a change to the list all at once, or drain the earlier version first.
- **Removing a team does not end its connections.** The resource server refuses them, but their rows stay.
- **Hand-written tools get the up-front `403` only if they declare `meta.requiredScopes`.** Without it each API call
  the tool makes is checked where it is made.
- **`tools/list` shows every tool**, including those the connection cannot use.
- **No consent screen on reconnect when nothing new is asked.** If everything a client asks for is already
  consented, Better Auth does not show the consent screen again.
- **The in-process principal is a bridge.** Inside the server an OAuth call is carried as a principal of type
  `'api-key'` with an `oauth` field, so a route that branches on `type === 'api-key'` treats a connection as a key.
  See [API Authentication](../05-api/02-authentication.md#oauth-access-token-authentication-apimcp-only).
- **The API key and connection models differ** in team binding and expiry, as the comparison table says. They are
  not unified.

---

## Related documentation

- [MCP Server](../05-api/20-mcp-server.md) - the endpoint, the tools, connecting a client, troubleshooting
- [API Authentication](../05-api/02-authentication.md) - the credentials of the API and where each is accepted
- [API Keys](./04-api-keys.md) - the other credential of `/api/mcp`
- [Rate Limiting](../05-api/07-rate-limiting.md) - tiers, the per-credential limit and Redis
- [Security Best Practices](./07-security-best-practices.md#mcp-browser-sign-in) - what an operator should do
- [MCP Browser Sign-In Deployment](../14-deployment/12-mcp-browser-sign-in.md) - the deployment checklist
- [RLS Policies](../10-backend/03-rls-policies.md#enforcement-layer-beta167) - the runtime database role and row-level security
- [OAuth Providers](./03-oauth-providers.md) - signing users in with Google and others, where the app is the client
