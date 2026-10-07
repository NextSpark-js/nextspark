import { withBasePath } from '../base-path'

/**
 * Leaves for the login page with a full page load, base path included. Sign-out and the dashboard guards use it.
 *
 * With Cache Components a client navigation out of the dashboard leaves it mounted, hidden, with its last render
 * ("signed out"); shown again after the next sign-in, its effects act on that and send the user back to /login. The
 * login page comes back as the form the last sign-in left. Loading the page drops the React tree, the session store
 * and the query cache together, whichever way the session ended (this tab's sign-out, another tab's, an expiry).
 */
export function loadLoginPage(): void {
  window.location.assign(withBasePath('/login'))
}
