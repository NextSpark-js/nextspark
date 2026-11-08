/**
 * A sign-in link is opened in a browser. Better Auth redirects the failures it
 * handles itself (a used or expired token, a registration refusal), and answers
 * JSON for the rest: the session hook's refusals (a suspended account, a domain
 * taken off the list), its rate limit, a callback URL it does not trust. Those
 * go to the error page too, with the code when there is one.
 */
import { withBasePath } from '../base-path'

export async function magicLinkFailurePage(response: Response, requestUrl: string): Promise<Response> {
  if (response.status < 400) return response
  const page = new URL(withBasePath('/auth-error'), requestUrl)
  try {
    const { code } = await response.clone().json() as { code?: unknown }
    if (typeof code === 'string') page.searchParams.set('error', code)
  } catch {
    // no JSON body: the generic message
  }
  return Response.redirect(page, 302)
}
