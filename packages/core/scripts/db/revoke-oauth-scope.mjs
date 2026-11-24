#!/usr/bin/env node

/**
 * `nextspark mcp:revoke-scope <scope>`: takes a permission of MCP browser sign-in (#541) away from every connection
 * that holds it, in every team.
 *
 * What it is for: retiring a tool stops its scope from being published and issued, and leaves it in the consents of
 * the connections that had it. If a tool ever needs that scope again, those connections would hold it again, for a
 * permission their users were asked about once, for another tool. This removes it from the consents, so holding it
 * again takes a new consent. Run it after the deployment that retires the tool is the only one serving.
 *
 * It also works on a scope a tool still needs: every connection loses it, and each application asks its user again
 * the next time it needs it.
 *
 * Without `--yes` it only says what it would do. The work is one statement of the database (migration 049,
 * `revoke_oauth_scope`): the live refresh tokens are cut down, the access tokens already issued are refused, and a
 * connection left with no entity permission is ended. It cannot be undone except by each user consenting again.
 *
 * The consents are service-only: it needs a role row-level security does not apply to, so it connects with
 * MIGRATE_DATABASE_URL, else DATABASE_SERVICE_URL, else DATABASE_URL, and refuses to run with a role that cannot
 * see them (it would report nothing to do).
 */

import { scriptClient } from './ssl-config.mjs';
import { describeDestination, rememberSecrets, scrub } from './destination.mjs';

const env = process.env;
const SCOPE = /^[^*\s]+:(read|write|delete)$/;

function refuse(message) {
  console.error(`❌ ${message} Nothing was changed.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = args.filter(argument => argument.startsWith('--'));
const positional = args.filter(argument => !argument.startsWith('--'));
const unknown = flags.find(flag => flag !== '--yes');
if (unknown) refuse(`Unknown argument: ${JSON.stringify(unknown)}. The only one is --yes.`);
if (positional.length !== 1) refuse('Name one scope: nextspark mcp:revoke-scope <entity>:<read|write|delete> [--yes].');
const [scope] = positional;
if (!SCOPE.test(scope)) refuse(`${JSON.stringify(scope)} is not an entity scope: use <entity>:read, <entity>:write or <entity>:delete.`);
const apply = flags.includes('--yes');

const url = env.MIGRATE_DATABASE_URL || env.DATABASE_SERVICE_URL || env.DATABASE_URL;
if (!url) refuse('None of MIGRATE_DATABASE_URL, DATABASE_SERVICE_URL and DATABASE_URL is set.');
rememberSecrets(url, env.DATABASE_URL, env.DATABASE_SERVICE_URL, env.MIGRATE_DATABASE_URL);
console.log(`🎯 Database: ${describeDestination(url)}`);

const client = scriptClient(url);
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

try {
  await client.connect();

  const { rows: [installed] } = await client.query(
    `SELECT to_regclass('public."oauthConsent"') IS NOT NULL AS tables, to_regprocedure('public.revoke_oauth_scope(text)') IS NOT NULL AS operation`
  );
  if (!installed.tables || !installed.operation) refuse('This database does not have migration 049_oauth_provider.sql: run the migrations first.');

  // A role row-level security applies to sees no consent at all: it would say there is nothing to do
  const { rows: [role] } = await client.query(
    `SELECT r.rolname AS name, (r.rolsuper OR r.rolbypassrls OR (pg_has_role(r.oid, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity)) AS "seesConsents"
       FROM pg_roles r, pg_class c
      WHERE r.rolname = current_user AND c.oid = 'public."oauthConsent"'::regclass`
  );
  if (!role?.seesConsents) {
    refuse(`The role this connects as (${role?.name ?? 'unknown'}) is subject to row-level security and cannot see the consents. Set MIGRATE_DATABASE_URL or DATABASE_SERVICE_URL to the owner of the tables or to a role with BYPASSRLS.`);
  }

  const { rows: [held] } = await client.query(
    `SELECT count(*)::int AS connections,
            count(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(consent.scopes) AS other(scope)
               WHERE other.scope <> $1 AND other.scope ~ '^.+:(read|write|delete)$'))::int AS "onlyThis"
       FROM public."oauthConsent" consent
      WHERE consent."referenceId" IS NOT NULL AND consent.scopes ? $1`,
    [scope]
  );
  const { rows: [resource] } = await client.query(
    `SELECT bool_or("allowedScopes" ? $1) AS active FROM public."oauthResource"`,
    [scope]
  );

  console.log(`Scope: ${scope}`);
  console.log(resource?.active
    ? '⚠️  A tool of the running app still needs this scope: connections lose it now, and each application asks its user for it again when it needs it.'
    : 'No tool of the running app needs this scope (it is not in the policy the app last published).');
  console.log(`Held by ${plural(held.connections, 'connection', 'connections')}; ${plural(held.onlyThis, 'of them holds', 'of them hold')} no other permission and would be ended.`);

  if (!apply) {
    console.log(held.connections ? '\nNothing was changed. Run it again with --yes to apply.' : '\nNothing to do.');
  } else {
    const { rows: [result] } = await client.query('SELECT narrowed, ended FROM public.revoke_oauth_scope($1)', [scope]);
    console.log(`\n✅ ${scope} revoked: ${plural(result.narrowed, 'connection', 'connections')} narrowed, ${result.ended} ended.`);
  }
  await client.end();
} catch (error) {
  console.error(`❌ Revoking the scope failed: ${scrub(error.message)}`);
  process.exit(1);
}
