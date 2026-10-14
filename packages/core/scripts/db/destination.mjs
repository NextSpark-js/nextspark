/**
 * What the migration scripts say about the database they connect to: the host and the
 * database name, never the user, the password or the URL.
 */

const secrets = new Set();

/** The destination of a connection URL, as `host H, database D`, or `unreadable URL`. */
export function describeDestination(connectionString) {
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    // A "/" or "@" in the database, or an "@" the parser did not take for credentials, means the URL did not
    // parse the way it was written (an unencoded "/" in the password): what it shows would be part of the password
    if (database.includes('/') || database.includes('@') || (!url.username && connectionString.replace(/^[^:]+:\/\//, '').split('/')[0].includes('@'))) {
      return 'unreadable URL';
    }
    return `host ${url.hostname || '(none)'}, database ${database || '(none)'}`;
  } catch {
    return 'unreadable URL';
  }
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
