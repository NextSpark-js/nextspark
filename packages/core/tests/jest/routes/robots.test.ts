/**
 * #214: core's /robots.txt route.
 */
import robots from '@/app/robots'

const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  if (BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = BASE_PATH
})

describe('robots', () => {
  it('allows the public pages and disallows the authenticated areas and the API', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/superadmin', '/devtools', '/api'] },
    })
  })

  it('follows the base path', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/app'
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/app', disallow: ['/app/dashboard', '/app/superadmin', '/app/devtools', '/app/api'] },
    })
  })
})
