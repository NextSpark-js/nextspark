import { revalidatePath, revalidateTag } from 'next/cache'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expirePublicEntity, PUBLIC_ROUTE_GROUP } from '@/core/lib/cache/public-entity-cache'

jest.mock('next/cache', () => ({ revalidateTag: jest.fn(), revalidatePath: jest.fn() }))

const tag = revalidateTag as unknown as jest.Mock
const path = revalidatePath as unknown as jest.Mock

describe('expirePublicEntity', () => {
  beforeEach(() => {
    tag.mockReset()
    path.mockReset()
  })

  it('expires the tag of every cached item and the root route of a "/" entity', () => {
    expirePublicEntity({ slug: 'pages', access: { basePath: '/' } } as never)
    expect(tag).toHaveBeenCalledWith('entity:pages', { expire: 0 })
    expect(path).toHaveBeenCalledWith('/(public)/[slug]', 'page')
  })

  it('uses the catch-all route when the entity allows nested slugs', () => {
    expirePublicEntity({ slug: 'pages', access: { basePath: '/', allowNestedSlugs: true } } as never)
    expect(path).toHaveBeenCalledWith('/(public)/[...slug]', 'page')
  })

  it('expires the item pages and the archive of an entity under a base path', () => {
    expirePublicEntity({ slug: 'posts', access: { basePath: '/blog' } } as never)
    expect(tag).toHaveBeenCalledWith('entity:posts', { expire: 0 })
    expect(path).toHaveBeenCalledTimes(1)
    expect(path).toHaveBeenCalledWith('/(public)/blog', 'layout')
  })

  it('reads the deprecated builder.public.basePath too', () => {
    expirePublicEntity({ slug: 'posts', builder: { public: { basePath: '/blog' } } } as never)
    expect(tag).toHaveBeenCalledWith('entity:posts', { expire: 0 })
  })

  it('leaves an entity without public pages alone', () => {
    expirePublicEntity({ slug: 'tasks', access: {} } as never)
    expirePublicEntity(undefined)
    expect(tag).not.toHaveBeenCalled()
    expect(path).not.toHaveBeenCalled()
  })

  it('expires the patterns tag when a pattern is written', () => {
    expirePublicEntity({ slug: 'patterns', access: {} } as never)
    expect(tag).toHaveBeenCalledWith('patterns', { expire: 0 })
  })

  it('does not throw outside a request, where Next refuses the call', () => {
    tag.mockImplementation(() => { throw new Error('Invariant: static generation store missing') })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => expirePublicEntity({ slug: 'pages', access: { basePath: '/' } } as never)).not.toThrow()
    warn.mockRestore()
  })

  it('keeps the route group equal to the one the host generator emits', () => {
    const generator = readFileSync(join(__dirname, '../../../../scripts/build/registry/host/entity-routes.mjs'), 'utf8')
    const targets = [...generator.matchAll(/`(\([a-z]+\))[^`]*`/g)].map(m => m[1])
    expect(targets.length).toBeGreaterThan(0)
    expect(new Set(targets)).toEqual(new Set([PUBLIC_ROUTE_GROUP]))
  })

  it('lets Next control-flow errors through', () => {
    const postpone = Object.assign(new Error('x'), { digest: 'NEXT_PRERENDER_INTERRUPTED' })
    tag.mockImplementation(() => { throw postpone })
    expect(() => expirePublicEntity({ slug: 'pages', access: { basePath: '/' } } as never)).toThrow(postpone)
  })
})
