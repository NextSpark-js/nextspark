/**
 * #344: a page renders only the patterns of its own team. Two teams, a pattern in each, a page of team A that
 * references both: the pattern of team B is skipped, the rest of the page still renders.
 */

const query = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }))

import { getResolvedBlocks } from '../../../src/routes/_internal/public-entity-shared'
import { PatternsResolverService } from '../../../src/lib/blocks/patterns-resolver.service'

const heroBlock = { id: 'h', blockSlug: 'hero', props: {} }
const ROWS = [
  { id: 'pat-A', teamId: 'team-A', status: 'published', blocks: [{ id: 'a1', blockSlug: 'cta-a', props: {} }] },
  { id: 'pat-B', teamId: 'team-B', status: 'published', blocks: [{ id: 'b1', blockSlug: 'cta-b', props: {} }] },
]
const ref = (id: string) => ({ type: 'pattern' as const, ref: id, id: `ref-${id}` })
const page = [heroBlock, ref('pat-A'), ref('pat-B')]

/** A table that honors the statement's last parameter as the team, like `"teamId" = $n`. */
beforeEach(() => {
  query.mockReset()
  query.mockImplementation(async (sql: string, params: string[]) => {
    const team = sql.includes('"teamId" = $') ? params[params.length - 1] : undefined
    const ids = team ? params.slice(0, -1) : params
    return { rows: ROWS.filter(r => ids.includes(r.id) && r.status === 'published' && (!team || r.teamId === team)) }
  })
})

describe('getResolvedBlocks with the team of the page', () => {
  it('expands the pattern of the page team and skips the one of another team', async () => {
    const blocks = await getResolvedBlocks(page, 'team-A')
    expect(blocks.map(b => b.blockSlug)).toEqual(['hero', 'cta-a'])
  })

  it('a page of the other team gets the other pattern only', async () => {
    const blocks = await getResolvedBlocks(page, 'team-B')
    expect(blocks.map(b => b.blockSlug)).toEqual(['hero', 'cta-b'])
  })

  it('renders the page without patterns when it has no team, without reading any', async () => {
    const blocks = await getResolvedBlocks(page, undefined)
    expect(blocks.map(b => b.blockSlug)).toEqual(['hero'])
    expect(query).not.toHaveBeenCalled()
  })

  it('passes the team to a cached reader', async () => {
    const getPatterns = jest.fn().mockResolvedValue([])
    await getResolvedBlocks(page, 'team-A', getPatterns)
    expect(getPatterns).toHaveBeenCalledWith(['pat-A', 'pat-B'], 'team-A')
  })

  it('does not break the page when the read fails', async () => {
    query.mockRejectedValue(new Error('down'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const blocks = await getResolvedBlocks(page, 'team-A')
    expect(blocks.map(b => b.blockSlug)).toEqual(['hero'])
  })
})

describe('PatternsResolverService.getByIds across teams', () => {
  it('returns nothing for the pattern of another team', async () => {
    expect(await PatternsResolverService.getByIds(['pat-B'], 'team-A')).toEqual([])
    expect((await PatternsResolverService.getByIds(['pat-B'], 'team-B')).map(p => p.id)).toEqual(['pat-B'])
  })
})
