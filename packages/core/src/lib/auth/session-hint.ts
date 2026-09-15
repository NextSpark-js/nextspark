/**
 * Session Hint
 *
 * Better Auth's session cookie is httpOnly, so client code cannot tell whether a
 * visitor is signed in without asking the server. This readable cookie records
 * whether the browser carries a session, and public pages ask for the session
 * only when it says so: an anonymous visitor makes no session request. The proxy
 * keeps it in line with the session cookie on every request, and client code
 * updates it on sign-in, sign-out and each session it reads. It is a hint, never
 * proof of anything: a stale one costs a single request that finds no session.
 */

export const SESSION_HINT_COOKIE = 'nextspark.signed_in'

/** As long as browsers keep a cookie: longer than any session. */
export const SESSION_HINT_MAX_AGE = 60 * 60 * 24 * 400

/** Better Auth's session cookie, `better-auth.session_token`, prefixed with `__Secure-` over HTTPS. */
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth[.-]session_token=[^;\s]/

/**
 * Whether a Cookie header carries Better Auth's session cookie. It says nothing
 * about whether that session is still valid, only that there may be one to read.
 */
export function hasSessionCookie(cookieHeader: string | null | undefined): boolean {
  return SESSION_COOKIE.test(cookieHeader ?? '')
}

/** Whether this browser was signed in when client code last looked. */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(part => part.trim() === `${SESSION_HINT_COOKIE}=1`)
}

/** Dispatched on window when client code changes the hint. */
const SESSION_HINT_CHANGE_EVENT = 'nextspark:session-hint-change'

/** Record whether this browser is signed in. */
export function setSessionHint(signedIn: boolean): void {
  if (typeof document === 'undefined' || hasSessionHint() === signedIn) return
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = signedIn
    ? `${SESSION_HINT_COOKIE}=1; Max-Age=${SESSION_HINT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
    : `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new Event(SESSION_HINT_CHANGE_EVENT))
}

/**
 * Call `onChange` whenever the hint may have changed: client code set it (a
 * sign-in or sign-out on this page), or the tab comes back into view, after
 * responses the proxy answered may have set it. Returns the function that stops
 * listening. Its shape fits React's useSyncExternalStore.
 */
export function subscribeSessionHint(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SESSION_HINT_CHANGE_EVENT, onChange)
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.removeEventListener(SESSION_HINT_CHANGE_EVENT, onChange)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}
