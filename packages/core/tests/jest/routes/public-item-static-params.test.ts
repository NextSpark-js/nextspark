/** The template's generateStaticParams, adapted to the slug shape of the generated route (#370). */
jest.mock('next/navigation', () => ({ notFound: jest.fn() }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: () => null }))

import { createPublicItemStaticParams } from '../../../src/routes/_internal/public-item-route'

describe('createPublicItemStaticParams', () => {
  it('a [...slug] route gets arrays: a string is split on /', async () => {
    const generate = createPublicItemStaticParams(() => [{ slug: 'about' }, { slug: 'docs/intro' }], true)
    expect(await generate()).toEqual([{ slug: ['about'] }, { slug: ['docs', 'intro'] }])
  })

  it('a [slug] route gets strings: an array is joined with /', async () => {
    const generate = createPublicItemStaticParams(() => [{ slug: ['docs', 'intro'] }, { slug: 'about' }], false)
    expect(await generate()).toEqual([{ slug: 'docs/intro' }, { slug: 'about' }])
  })

  it('the shape the route already has stays as it is, and the round trip keeps the levels', async () => {
    expect(await createPublicItemStaticParams(() => [{ slug: ['a', 'b'] }], true)()).toEqual([{ slug: ['a', 'b'] }])
    expect(await createPublicItemStaticParams(() => [{ slug: 'a/b' }], false)()).toEqual([{ slug: 'a/b' }])
    const toArray = await createPublicItemStaticParams(() => [{ slug: 'a/b' }], true)()
    expect(await createPublicItemStaticParams(() => toArray, false)()).toEqual([{ slug: 'a/b' }])
  })

  it('an async generator works and the other keys of each entry are kept', async () => {
    const generate = createPublicItemStaticParams(async () => [{ slug: 'a/b', locale: 'es' }], true)
    expect(await generate()).toEqual([{ slug: ['a', 'b'], locale: 'es' }])
  })
})
