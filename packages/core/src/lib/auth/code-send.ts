/**
 * Reports a sign-in code email that could not be sent.
 *
 * Better Auth 1.7's emailOTP route catches whatever sendVerificationOTP throws
 * (runInBackgroundOrAwait logs it), and with `advanced.backgroundTasks` it
 * does not even wait for the send: the route always answers 200. The auth
 * route runs each request through withCodeSendOutcome, sendVerificationOTP
 * registers its sign-in send here, and a failed send turns the response into
 * EMAIL_SEND_FAILED. The provider's error stays in the server log; the client
 * only gets the code and a fixed message. The wait is bounded by
 * CODE_SEND_TIMEOUT_MS: a provider that does not answer by then counts as
 * failed, so the request ends with EMAIL_SEND_FAILED instead of the platform's
 * own timeout.
 *
 * Only sign-in codes are tracked: Better Auth sends one for every address,
 * known or not, so the error tells nothing about whether an account exists.
 * Verification and password-reset codes go only to existing accounts, and
 * their failures stay in the log.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export const EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED'
export const CODE_SEND_TIMEOUT_MS = 10_000

const codeSends = new AsyncLocalStorage<Promise<unknown>[]>()

/** Registers a sign-in code send with the current auth request, if any, and returns it. */
export function trackCodeSend<T>(send: Promise<T>): Promise<T> {
  codeSends.getStore()?.push(send)
  return send
}

/** Runs an auth request; waits for the code sends it started and answers EMAIL_SEND_FAILED when one failed. */
export async function withCodeSendOutcome(handler: () => Promise<Response>): Promise<Response> {
  const sends: Promise<unknown>[] = []
  const response = await codeSends.run(sends, handler)
  if (!response.ok || sends.length === 0) return response

  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), CODE_SEND_TIMEOUT_MS)
  })
  const outcomes = await Promise.race([Promise.allSettled(sends), timedOut]).finally(() => clearTimeout(timer))
  if (outcomes === 'timeout') console.error('[auth] The sign-in code email timed out')
  else if (outcomes.every(({ status }) => status === 'fulfilled')) return response
  return new Response(
    JSON.stringify({ code: EMAIL_SEND_FAILED, message: 'The email could not be sent. Try again later.' }),
    { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  )
}
