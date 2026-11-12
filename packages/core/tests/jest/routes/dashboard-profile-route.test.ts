/**
 * @jest-environment node
 *
 * /dashboard/profile goes to /dashboard/settings/profile with a temporary redirect (#433, #452): a permanent one is
 * kept by browsers, which would shadow a project page at that path for good.
 */
import { GET, HEAD } from '../../../src/routes/dashboard/profile/route'

describe('/dashboard/profile route', () => {
  test.each([
    ['https://app.test/dashboard/profile', '/dashboard/settings/profile'],
    ['https://app.test/dashboard/profile?tab=x&a=1', '/dashboard/settings/profile?tab=x&a=1'],
  ])('%s answers 307 to %s', (url, location) => {
    for (const handler of [GET, HEAD]) {
      const response = handler(new Request(url))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(location)
    }
  })

  test('under a basePath the Location carries it', () => {
    const previous = process.env.__NEXT_ROUTER_BASEPATH
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    try {
      const response = GET(new Request('https://app.test/base/dashboard/profile?x=1'))
      expect(response.headers.get('location')).toBe('/base/dashboard/settings/profile?x=1')
    } finally {
      if (previous === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
      else process.env.__NEXT_ROUTER_BASEPATH = previous
    }
  })
})
