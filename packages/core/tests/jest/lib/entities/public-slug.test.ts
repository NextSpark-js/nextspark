/**
 * Public entity slugs (#215): the one rule every write path shares.
 */
import { hasPublicSlug, otherBasePathSegments, publicSlugIssue, validatePublicSlug } from '@/core/lib/entities/public-slug'
import { validatePageSlug } from '@/core/lib/constants/reserved-slugs'
import type { EntityConfig } from '@/core/lib/entities/types'

const slugField = { name: 'slug' }
const entity = (config: Record<string, unknown>) => ({ slug: 'things', fields: [slugField], ...config }) as unknown as EntityConfig

const pages = entity({ access: { public: true, basePath: '/' } })
const nestedPages = entity({ access: { public: true, basePath: '/', allowNestedSlugs: true } })
const posts = entity({ access: { public: true, basePath: '/blog' } })
const custom = entity({ access: { public: true } })

describe('validatePublicSlug', () => {
  it.each(['about', 'my-page-2', '2026', 'ab'])('accepts %s', slug => {
    expect(validatePublicSlug(pages, slug)).toBeNull()
  })

  it.each(['Hello', 'two words', 'a_b', 'v1.2', 'café', '-a', 'a-', 'a--b', 'a', '../x', 'x'.repeat(101)])('refuses %j', slug => {
    expect(validatePublicSlug(pages, slug)).toEqual(expect.any(String))
  })

  it('refuses the routes core serves at the root, through validatePageSlug', () => {
    for (const slug of ['dashboard', 'api', 'superadmin', 'devtools', 'docs', 'login', 'verify-email', 'accept-invite', 'auth-error', '403', 'public']) {
      expect(validatePublicSlug(pages, slug)).toBe(validatePageSlug(slug))
    }
    expect(validatePublicSlug(pages, 'dashboard')).toBe('Slug "dashboard" is reserved by the system')
  })

  it('allows words that no route answers', () => {
    for (const slug of ['home', 'v1', 'v2', 'index', 'blog', 'admin', 'register', 'images']) {
      expect(validatePublicSlug(pages, slug)).toBeNull()
    }
  })

  it("refuses the first segment of another entity's base path", () => {
    const taken = otherBasePathSegments(pages, [pages, posts, entity({ access: { public: true, basePath: '/category/x' } }), custom])
    expect(taken).toEqual(['blog', 'category'])
    expect(validatePublicSlug(pages, 'blog', taken)).toBe('Slug "blog" is reserved by the system')
    expect(validatePublicSlug(pages, 'category', taken)).toEqual(expect.any(String))
    expect(validatePublicSlug(pages, 'about', taken)).toBeNull()
    expect(validatePublicSlug(posts, 'blog', taken)).toBeNull()
  })

  it('does not apply the reserved list below another base path or to an entity without one', () => {
    expect(validatePublicSlug(posts, 'dashboard')).toBeNull()
    expect(validatePublicSlug(custom, 'v1')).toBeNull()
    expect(validatePublicSlug(posts, 'Bad Slug')).toEqual(expect.any(String))
  })

  it('refuses a slash unless nested slugs are allowed, then judges each segment', () => {
    expect(validatePublicSlug(pages, 'a/b')).toBe('Slug cannot contain slashes')
    expect(validatePublicSlug(custom, 'a/b')).toBe('Slug cannot contain slashes')
    expect(validatePublicSlug(nestedPages, 'qa/block/home-qa-us')).toBeNull()
    expect(validatePublicSlug(nestedPages, 'qa/Bad')).toEqual(expect.any(String))
    expect(validatePublicSlug(nestedPages, 'dashboard/x')).toBe('Slug "dashboard" is reserved by the system')
    expect(validatePublicSlug(posts, 'ab/cd')).toBeNull()
  })
})

describe('publicSlugIssue', () => {
  it('names the slug field in a Zod-shaped issue', () => {
    expect(publicSlugIssue(pages, { slug: 'Bad Slug' })).toMatchObject({ path: ['slug'], message: expect.any(String) })
  })

  it('is null for a valid slug, a body without one, a null slug and an entity whose slug is not public', () => {
    expect(publicSlugIssue(pages, { slug: 'about' })).toBeNull()
    expect(publicSlugIssue(pages, { title: 'x' })).toBeNull()
    expect(publicSlugIssue(pages, { slug: null })).toBeNull()
    expect(publicSlugIssue(entity({ access: { public: false } }), { slug: 'Not Public' })).toBeNull()
    expect(publicSlugIssue(entity({ access: { public: true }, fields: [] }), { slug: 'Bad Slug' })).toBeNull()
  })

  it('covers a public custom entity', () => {
    expect(hasPublicSlug(custom)).toBe(true)
    expect(publicSlugIssue(custom, { slug: 'Bad Slug' })).not.toBeNull()
  })
})
