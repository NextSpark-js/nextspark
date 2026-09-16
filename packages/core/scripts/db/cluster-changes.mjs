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
    change: 'created if missing, set to INHERIT, granted authenticated, granted to the connecting user',
    altered: true,
  },
]

const ALTERED_ROLES = new Set(GLOBAL_OBJECTS.filter(object => object.altered).map(object => object.role))

/**
 * Databases a managed Postgres creates for itself. Their presence says nothing
 * about the server being in use — `postgres` is asked about separately, since
 * a hosted project can keep the app's own schema there.
 */
const HOUSEKEEPING_DATABASES = new Set(['postgres', 'rdsadmin', 'azure_maintenance', 'azure_sys', 'cloudsqladmin'])

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

export const DATABASES_SQL = `
  SELECT datname AS name
    FROM pg_database
   WHERE datallowconn
     AND NOT datistemplate
     AND datname <> current_database()
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
 */
export function inspectCluster({ roles = [], databases = [], maintenanceObjects = [] } = {}) {
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

  return { disposable: reasons.length === 0, reasons, existingRoles, otherDatabases }
}
