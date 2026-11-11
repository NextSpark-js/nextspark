/**
 * The toast text of a failed users-table action (#433): a 429 says how long to wait instead of the route's
 * "Rate limit exceeded"; a body that is not JSON gives the fallback, not a parse error; other failures keep the route's text.
 */
import { actionErrorMessage, rateLimitedMessage } from '@/core/components/users/tables/action-error'

// the English catalog, as the tables read it
const { useTranslations } = jest.requireActual('../../__mocks__/next-intl.js')
const t = useTranslations('superadmin.users')

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

test.each([
  ['3600', 'Too many requests. Try again in 60 minutes.'],
  ['30', 'Too many requests. Try again in 1 minute.'],
  [undefined, 'Too many requests. Try again in 1 minute.'],
])('a 429 with Retry-After %s says how long to wait', async (retryAfter, text) => {
  const response = json(429, { error: 'Rate limit exceeded' }, retryAfter ? { 'Retry-After': retryAfter } : {})
  expect(await actionErrorMessage(response, t, 'Action failed')).toBe(text)
})

// the users list and a user's page put it in their error card instead of "Failed to fetch users data"
test('the pages read the same wait for a 429, and nothing for another status', () => {
  expect(rateLimitedMessage(json(429, {}, { 'Retry-After': '120' }), t)).toBe('Too many requests. Try again in 2 minutes.')
  expect(rateLimitedMessage(json(500, {}), t)).toBeNull()
})

test('the refusal to remove the last superadmin reads the catalog (#433)', async () => {
  const response = json(409, { error: 'Cannot demote, suspend or delete the last superadmin', code: 'LAST_SUPERADMIN' })
  expect(await actionErrorMessage(response, t, 'Action failed')).toBe('The last superadmin cannot be demoted, suspended or deleted. Make another user a superadmin first.')
})

test('a refusal keeps the route text', async () => {
  const response = json(403, { error: 'Forbidden - Only a developer can grant the developer role' })
  expect(await actionErrorMessage(response, t, 'Action failed')).toBe('Forbidden - Only a developer can grant the developer role')
})

test('a body that is not JSON gives the fallback', async () => {
  const response = new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })
  expect(await actionErrorMessage(response, t, 'Action failed')).toBe('Action failed')
})
