/**
 * What the migration scripts say about the database they connect to: the host and the
 * database name, never the user, the password or the URL.
 */

const secrets = new Set();

/**
 * The host and database a connection URL names: `{ host, database }`, either possibly empty, or null when the URL does
 * not read the way it was written. A `host` in the query string (a socket directory, or the host of a URL with none in
 * the authority) is the one pg connects to, so it is the one named.
 */
export function destinationParts(connectionString, env = process.env) {
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    // A "/" or "@" in the database, or an "@" the parser did not take for credentials, means the URL did not
    // parse the way it was written (an unencoded "/" in the password): what it shows would be part of the password
    if (database.includes('/') || database.includes('@') || (!url.username && connectionString.replace(/^[^:]+:\/\//, '').split('/')[0].includes('@'))) {
      return null;
    }
    // With no host at all, node-postgres connects to PGHOST (or PGHOSTADDR)
    return { host: url.searchParams.get('host') || url.hostname || env.PGHOST || env.PGHOSTADDR || '', database };
  } catch {
    return null;
  }
}

/** The destination of a connection URL, as `host H, database D`, or `unreadable URL`. */
export function describeDestination(connectionString, env = process.env) {
  const parts = destinationParts(connectionString, env);
  return parts ? `host ${parts.host || '(none)'}, database ${parts.database || '(none)'}` : 'unreadable URL';
}

const sameHost = (a, b) => a.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '') === b.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

/**
 * Why a connection URL is not the target that was expected (`--expect-database`, `--expect-host`), or null when it is or
 * nothing was expected. It names the host and database only, never the user, the password or the URL.
 */
export function unexpectedTarget(connectionString, { database = null, host = null } = {}, env = process.env) {
  if (database === null && host === null) return null;
  const parts = destinationParts(connectionString, env);
  const flags = [database !== null && `--expect-database ${database}`, host !== null && `--expect-host ${host}`].filter(Boolean).join(' ');
  if (!parts) return `${flags}: the connection URL cannot be read, so the target cannot be checked.`;
  const wrong = [];
  if (database !== null && parts.database !== database) wrong.push(`database ${parts.database || '(none)'} (expected ${database})`);
  if (host !== null && !sameHost(parts.host, host)) wrong.push(`host ${parts.host || '(none)'} (expected ${host})`);
  return wrong.length > 0 ? `${flags}: the connection points at ${wrong.join(' and ')}.` : null;
}

/** Remembers the credentials in these URLs, so `scrub` can take them out of a message. */
export function rememberSecrets(...connectionStrings) {
  for (const connectionString of connectionStrings) {
    if (!connectionString) continue;
    secrets.add(connectionString);
    // What stands before the last "@" is credentials, however the URL parser splits it
    const rest = connectionString.replace(/^[^:]+:\/\//, '');
    const at = rest.lastIndexOf('@');
    if (at > 0) for (const part of [rest.slice(0, at), ...rest.slice(0, at).split(/[:/]/)]) if (part.length > 1) secrets.add(part);
    try {
      const url = new URL(connectionString);
      for (const part of [url.username, url.password]) {
        if (part) secrets.add(part).add(decodeURIComponent(part));
      }
    } catch {}
  }
}

/** `message` with the remembered user, password and URLs replaced by `***`. */
export function scrub(message) {
  let text = String(message);
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join('***');
  }
  return text;
}
