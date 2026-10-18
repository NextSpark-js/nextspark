/**
 * The wait for a sign-in code send is bounded: a provider that never answers
 * ends the request with EMAIL_SEND_FAILED after CODE_SEND_TIMEOUT_MS instead
 * of holding it until the platform's own timeout.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { CODE_SEND_TIMEOUT_MS, trackCodeSend, withCodeSendOutcome } from '@/core/lib/auth/code-send'

const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 })

describe('withCodeSendOutcome', () => {
  let consoleError: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    jest.useFakeTimers()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('a send that never settles answers EMAIL_SEND_FAILED once the timeout passes', async () => {
    let settled = false
    const outcome = withCodeSendOutcome(async () => {
      trackCodeSend(new Promise(() => undefined))
      return ok()
    }).then((response) => {
      settled = true
      return response
    })

    await jest.advanceTimersByTimeAsync(CODE_SEND_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await jest.advanceTimersByTimeAsync(1)

    const response = await outcome
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'EMAIL_SEND_FAILED' })
    expect(consoleError).toHaveBeenCalledWith('[auth] The sign-in code email timed out')
  })

  test('a send that finishes in time keeps the response, and leaves no timer behind', async () => {
    const outcome = withCodeSendOutcome(async () => {
      trackCodeSend(new Promise((resolve) => setTimeout(resolve, 1000)))
      return ok()
    })

    await jest.advanceTimersByTimeAsync(1000)
    expect((await outcome).status).toBe(200)
    expect(jest.getTimerCount()).toBe(0)
    expect(consoleError).not.toHaveBeenCalled()
  })

  test('a request that sends no code answers at once, with no timer', async () => {
    const response = await withCodeSendOutcome(async () => ok())
    expect(response.status).toBe(200)
    expect(jest.getTimerCount()).toBe(0)
  })
})
