// What a theme verification run changes outside the database it was given.
//
// A migration run is not contained in its database: 001 creates the
// `authenticated`, `anon` and `service_role` roles, and 022 creates
// `nextspark_app`, sets it to INHERIT and grants it `authenticated` plus
// membership to the connecting user. Roles are cluster-wide, so those
// statements reach every other database on the same Postgres server, including
// ones the run was never pointed at.
//
// The database being empty says nothing about that, which is why the checks
// here look at the cluster: the roles the migrations touch, and whether any
// other database is using this server.

/**
 * Roles the core migrations create or alter, and what they do to each.
 * `altered` separates the one whose attributes and memberships the migrations
 * change even when it is already there from the ones a Supabase project
 * already has and 001 only fills in.
 */
export const GLOBAL_OBJECTS = [
  { role: 'authenticated', change: 'created if missing', altered: false },
  { role: 'anon', change: 'created if missing', altered: false },
  { role: 'service_role', change: 'created if missing', altered: false },
  {
    role: 'nextspark_app',
    change: 'created if missing, set to INHERIT, granted authenticated',
    altered: true,
  },
  {
    role: 'current_user',
    change: 'granted nextspark_app, so whoever runs this can SET ROLE to it',
    altered: true,
    connecting: true,
  },
]

// `current_user` is whoever connects, so it is announced but never looked for
// among the roles the server already has.
const ALTERED_ROLES = new Set(
  GLOBAL_OBJECTS.filter(object => object.altered && !object.connecting).map(object => object.role)
)

/**
 * Databases a Postgres server creates for itself, or a managed one adds. Their
 * presence says nothing about the server being in use — `postgres` is asked
 * about separately, since a hosted project can keep the app's own schema there.
 *
 * Only `template0` and `template1` among templates: any database can be marked
 * `datistemplate`, and one a user marked that way shares the cluster's roles
 * like any other.
 */
const HOUSEKEEPING_DATABASES = new Set([
  'postgres', 'template0', 'template1', 'rdsadmin', 'azure_maintenance', 'azure_sys', 'cloudsqladmin',
])

/** The database a client connects to when it only needs the server. */
export const MAINTENANCE_DATABASE = 'postgres'

export const ROLES_SQL = `
  SELECT r.rolname AS name,
         r.rolcanlogin AS can_login,
         COALESCE(array_agg(g.rolname) FILTER (WHERE g.rolname IS NOT NULL), '{}'::text[]) AS member_of
    FROM pg_roles r
    LEFT JOIN pg_auth_members m ON m.member = r.oid
    LEFT JOIN pg_roles g ON g.oid = m.roleid
   WHERE r.rolname IN ('authenticated', 'anon', 'service_role')
      OR r.rolname LIKE 'nextspark\\_%'
   GROUP BY r.rolname, r.rolcanlogin
   ORDER BY r.rolname
`

// A database that refuses connections (`datallowconn = false`) or is marked as
// a template is still a database on this server, sharing the roles this run
// alters, so it counts. The server's own templates are left out by name, in
// HOUSEKEEPING_DATABASES.
export const DATABASES_SQL = `
  SELECT datname AS name
    FROM pg_database
   WHERE datname <> current_database()
   ORDER BY datname
`

/** An array of role names, whether the driver hands over an array or `{a,b}`. */
function asList(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  return value.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
}

/**
 * What the run would change beyond its own database, and whether the cluster
 * shows signs of being used by anything else.
 *
 * A role the migrations touch that already exists is the stronger signal: the
 * run alters it for whoever else is using it. Another database on the server is
 * the weaker one, and enough on its own — a role created now lands in a cluster
 * that is not this run's to change.
 *
 * `maintenance` is what looking at the `postgres` database answered:
 * `{ objects }` when it could be read, `{ unreachable: true, reason }` when it
 * could not. Not being able to look is itself a reason to refuse — a server
 * that denies CONNECT to its own maintenance database is a managed one with
 * someone else's rules on it, not a container this run may rearrange.
 */
export function inspectCluster({ roles = [], databases = [], maintenance = {} } = {}) {
  const maintenanceObjects = maintenance.objects ?? []
  const existingRoles = roles.map(role => ({
    name: role.name,
    canLogin: role.can_login ?? role.canLogin ?? false,
    memberOf: asList(role.member_of ?? role.memberOf),
  }))
  const otherDatabases = databases
    .map(database => database.name ?? database)
    .filter(name => !HOUSEKEEPING_DATABASES.has(name))

  const describe = role => (role.memberOf.length ? `${role.name} (member of ${role.memberOf.join(', ')})` : role.name)
  const altered = existingRoles.filter(role => ALTERED_ROLES.has(role.name) || role.name.startsWith('nextspark_'))
  const shared = existingRoles.filter(role => !altered.includes(role))

  const reasons = []
  if (altered.length > 0) {
    reasons.push(`this run alters roles that are already here: ${altered.map(describe).join(', ')}`)
  }
  if (shared.length > 0) {
    reasons.push(
      `roles these migrations create already exist, so something else set this server up: ${shared.map(describe).join(', ')}`
    )
  }
  if (otherDatabases.length > 0) {
    const shown = otherDatabases.slice(0, 5).join(', ')
    const rest = otherDatabases.length > 5 ? `, and ${otherDatabases.length - 5} more` : ''
    reasons.push(`other databases share this server: ${shown}${rest}`)
  }
  if (maintenanceObjects.length > 0) {
    const examples = maintenanceObjects.slice(0, 3).map(object => object.name ?? object).join(', ')
    reasons.push(`the ${MAINTENANCE_DATABASE} database holds objects of its own, for example ${examples}`)
  }
  if (maintenance.unreachable) {
    const detail = maintenance.reason ? `: ${maintenance.reason}` : ''
    reasons.push(
      `the ${MAINTENANCE_DATABASE} database could not be read${detail}, so what else is on this server is unknown`
    )
  }

  return { disposable: reasons.length === 0, reasons, existingRoles, otherDatabases }
}

/**
 * Words that can stand where a role name would, in the statements above:
 * GRANT's own syntax, the privileges it grants, and the objects it grants them
 * on. None of them is a role.
 */
const GRANT_KEYWORDS = new Set([
  'ALL', 'PRIVILEGES', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
  'CREATE', 'CONNECT', 'TEMPORARY', 'TEMP', 'EXECUTE', 'USAGE', 'SET', 'ALTER', 'MAINTAIN',
  'ON', 'IN', 'SCHEMA', 'TABLE', 'TABLES', 'SEQUENCE', 'SEQUENCES', 'FUNCTION', 'FUNCTIONS',
  'ROUTINE', 'ROUTINES', 'DATABASE', 'DOMAIN', 'TYPE', 'LANGUAGE', 'PUBLIC', 'SYSTEM',
  'FOREIGN', 'DATA', 'WRAPPER', 'SERVER', 'LARGE', 'OBJECT', 'TABLESPACE', 'PARAMETER',
  'OPTION', 'ADMIN', 'INHERIT', 'GRANTED', 'BY', 'FOR', 'ROLE', 'COLUMN',
])

/**
 * Every role a migration names, whichever statement names it.
 *
 * Both sides of a grant count: `GRANT authenticated TO reporting` alters
 * `reporting` as much as it uses `authenticated`, and a grant of privileges —
 * `GRANT SELECT ON ... TO reporting` — names only the grantee. A grant can list
 * several of either, so each list is split on commas.
 */
export function rolesNamedIn(sql) {
  const named = new Set()
  // Comments and RAISE messages are prose: a GRANT quoted inside either is
  // being talked about, not run. A GRANT inside format() is run, so string
  // literals in general stay.
  const statements = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\bRAISE\s+(?:DEBUG|LOG|INFO|NOTICE|WARNING|EXCEPTION)\b[^;]*;/gi, ' ')

  const add = list => {
    for (const name of list.split(',')) {
      // A grantee list can end inside a format() call, so the string and the
      // call close on the last name: `format('GRANT x TO %I', current_user)`.
      const role = name.trim().replace(/[)'"]+$/, '').replace(/^["']+/, '')
      // GRANT's own keywords, and the object a privilege is granted on, are
      // not roles; `format('... %I', current_user)` names the connecting user.
      if (/^[a-z_]\w*$/i.test(role) && !GRANT_KEYWORDS.has(role.toUpperCase())) named.add(role)
    }
  }

  for (const [, list] of statements.matchAll(/\b(?:CREATE|ALTER|DROP)\s+(?:ROLE|USER|GROUP)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?("?\w+"?)/gi)) {
    add(list)
  }
  // The grantee list runs from the last TO/FROM to the end of the statement,
  // past any WITH ADMIN OPTION / GRANTED BY tail.
  for (const [, grantees] of statements.matchAll(/\b(?:GRANT|REVOKE)\b[^;]*?\s(?:TO|FROM)\s+([^;]+)/gi)) {
    add(grantees.split(/\bWITH\b|\bGRANTED\s+BY\b|\bCASCADE\b|\bRESTRICT\b/i)[0])
  }
  // What a grant of role membership hands over, which is a role too.
  for (const [, roles] of statements.matchAll(/\b(?:GRANT|REVOKE)\s+((?:"?\w+"?\s*,\s*)*"?\w+"?)\s+(?:TO|FROM)\s/gi)) {
    add(roles)
  }

  return named
}
