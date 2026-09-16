/**
 * A docs page's own relative `.md` links must resolve to the route the page
 * builder serves, not the source-tree path the browser can never fetch
 * (#200 docs review: 19 of 24 internal doc links were dead for this reason).
 */
import { resolveRelativeDocLink, remarkDocLinks } from '@/core/lib/docs/remark-doc-links'

const PUBLIC_FILE = '/repo/themes/default/docs/public/01-overview/01-introduction.md'
const SUPERADMIN_FILE = '/repo/themes/default/docs/superadmin/01-setup/01-configuration.md'

describe('resolveRelativeDocLink', () => {
  test('routes a same-section link', () => {
    expect(resolveRelativeDocLink('./02-customization.md', PUBLIC_FILE)).toBe('/docs/overview/customization')
  })

  test('routes a link into a sibling section', () => {
    expect(resolveRelativeDocLink('../02-features/01-components.md', PUBLIC_FILE)).toBe('/docs/features/components')
  })

  test('routes within the superadmin tree to the superadmin route', () => {
    expect(resolveRelativeDocLink('./02-deployment.md', SUPERADMIN_FILE)).toBe('/superadmin/docs/setup/deployment')
    expect(resolveRelativeDocLink('../02-management/01-users.md', SUPERADMIN_FILE)).toBe('/superadmin/docs/management/users')
  })

  test('keeps a trailing hash', () => {
    expect(resolveRelativeDocLink('./02-customization.md#theming', PUBLIC_FILE)).toBe('/docs/overview/customization#theming')
  })

  test('leaves an absolute link alone', () => {
    expect(resolveRelativeDocLink('/docs/core/theme-system/introduction', PUBLIC_FILE)).toBeNull()
  })

  test('leaves an external URL alone', () => {
    expect(resolveRelativeDocLink('https://nextjs.org', PUBLIC_FILE)).toBeNull()
  })

  test('leaves a relative link that escapes the docs tree alone', () => {
    // No route serves a plugin's own docs, so there is nothing to point at.
    expect(resolveRelativeDocLink('../../../plugins/langchain/docs/06-tools.md', PUBLIC_FILE)).toBeNull()
  })
})

describe('remarkDocLinks', () => {
  test('rewrites link node urls in place, recursively', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'See ' },
            { type: 'link', url: './02-customization.md', children: [{ type: 'text', value: 'Customization' }] },
          ],
        },
      ],
    }

    remarkDocLinks(PUBLIC_FILE)(tree)

    expect(tree.children[0].children[1].url).toBe('/docs/overview/customization')
  })

  test('leaves an unresolvable link url untouched', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'link', url: '/docs/core/theme-system/introduction', children: [] }],
    }

    remarkDocLinks(PUBLIC_FILE)(tree)

    expect(tree.children[0].url).toBe('/docs/core/theme-system/introduction')
  })
})
