/**
 * lib/auth/background-tasks: Better Auth's background task handler. Within a request the task goes to Next's
 * after(); outside one (after() throws) it runs detached. A failing task never becomes an unhandled rejection.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

const mockAfter = jest.fn()
jest.mock('next/server', () => ({ after: (task: unknown) => mockAfter(task) }))

import { runAfterResponse } from '@/core/lib/auth/background-tasks'

describe('runAfterResponse', () => {
  beforeEach(() => mockAfter.mockReset())

  test('hands the task to after() and returns at once', async () => {
    let finish: (value: string) => void = () => {}
    const task = new Promise<string>(resolve => { finish = resolve })
    expect(runAfterResponse(task)).toBeUndefined()
    expect(mockAfter).toHaveBeenCalledTimes(1)
    const handed = mockAfter.mock.calls[0][0] as Promise<unknown>
    expect(handed).toBeInstanceOf(Promise)
    finish('sent')
    await expect(handed).resolves.toBe('sent')
  })

  test('a failing task settles quietly', async () => {
    runAfterResponse(Promise.reject(new Error('smtp down')))
    await expect(mockAfter.mock.calls[0][0] as Promise<unknown>).resolves.toBeUndefined()
  })

  test('outside a request scope it runs the task detached instead of throwing', async () => {
    mockAfter.mockImplementation(() => { throw new Error('`after` was called outside a request scope') })
    let ran = false
    expect(() => runAfterResponse(Promise.resolve().then(() => { ran = true }))).not.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(ran).toBe(true)
  })
})
