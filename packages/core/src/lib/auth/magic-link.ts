/**
 * A sign-in link is opened in a browser. Better Auth redirects the failures it
 * handles itself (a used or expired token, a registration refusal), and answers
 * JSON for the rest: the session hook's refusals (a suspended account, a domain
 * taken off the list), its rate limit, a callback URL it does not trust, and
 * the readiness gate answers the same way without a working email provider.
 * Those go to the error page too, with the code when there is one.
 *
 * The Location is relative: behind a proxy the request's URL carries the
 * internal host, and the browser resolves this against the address it opened.
 */
import { withBasePath } from '../base-path'

export async function magicLinkFailurePage(response: Response): Promise<Response> {
  if (response.status < 400) return response
  let query = ''
  try {
    const { code } = await response.clone().json() as { code?: unknown }
    if (typeof code === 'string') query = `?error=${encodeURIComponent(code)}`
  } catch {
    // no JSON body: the generic message
  }
  return new Response(null, { status: 302, headers: { location: `${withBasePath('/auth-error')}${query}` } })
}
