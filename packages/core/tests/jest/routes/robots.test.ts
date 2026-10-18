/**
 * #214: core's /robots.txt route.
 */
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'
import robots from '@/app/robots'
import { createRobotsRoute } from '@/app/_internal/robots-route'

const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
const AREAS = ['/dashboard', '/superadmin', '/devtools', '/api']
// each area by itself, its subpaths and its query URLs: `/api` alone would also block `/apiary`
const blocked = (prefix = '') => AREAS.flatMap(path => ['$', '/', '?'].map(end => `${prefix}${path}${end}`))
const DISALLOWED = blocked()

// Google's matching: `*` is any run, a trailing `$` anchors the end, the rest is a prefix of path + query
const matches = (rule: string, url: string) =>
  new RegExp('^' + rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\$$/, '$')).test(url)
const isBlocked = (url: string) => (robots().rules as { disallow: string[] }).disallow.some(rule => matches(rule, url))

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
      rules: { userAgent: '*', allow: '/app', disallow: blocked('/app') },
      sitemap: 'https://example.com/app/sitemap.xml',
    })
  })

  it('renders exactly the area lines and the Sitemap line', () => {
    expect(resolveRobots(robots())).toBe(
      [
        'User-Agent: *',
        'Allow: /',
        ...DISALLOWED.map(path => `Disallow: ${path}`),
        '',
        'Sitemap: https://example.com/sitemap.xml',
        '',
      ].join('\n'),
    )
  })

  it('blocks each area, its subpaths and its query URLs, and nothing else', () => {
    for (const url of ['/api', '/api/v1/x', '/api?x=1', '/dashboard', '/dashboard/teams', '/dashboard?tab=1', '/superadmin', '/devtools?x']) {
      expect(isBlocked(url)).toBe(true)
    }
    for (const url of ['/', '/apiary', '/dashboards-guide', '/support', '/blog/api']) expect(isBlocked(url)).toBe(false)
  })
})
