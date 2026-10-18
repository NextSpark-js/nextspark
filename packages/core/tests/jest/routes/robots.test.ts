/**
 * #214: core's /robots.txt route.
 */
import robots from '@/app/robots'
import { createRobotsRoute } from '@/app/_internal/robots-route'

const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
const DISALLOWED = ['/dashboard', '/superadmin', '/devtools', '/api']

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/'
})

afterEach(() => {
  if (BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = BASE_PATH
  if (APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = APP_URL
})

describe('robots', () => {
  it('allows the public pages, disallows the authenticated areas and the API, and advertises the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: DISALLOWED },
      sitemap: 'https://example.com/sitemap.xml',
    })
  })

  it('leaves the sitemap line out when the sitemap is off', () => {
    expect(createRobotsRoute({ sitemap: false })()).toEqual({ rules: { userAgent: '*', allow: '/', disallow: DISALLOWED } })
  })

  it('follows the base path', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/app'
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/app', disallow: DISALLOWED.map(path => `/app${path}`) },
      sitemap: 'https://example.com/app/sitemap.xml',
    })
  })
})
