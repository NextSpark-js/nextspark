/**
 * #344: PagesManagementService.create (both template copies) keeps only the pattern references of the page's team,
 * so a caller that persists `blocks` without going through the generic handler cannot embed another team's pattern.
 */
import { join } from 'node:path'

const mutateWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
  mutateWithRLS: (...a: unknown[]) => mutateWithRLS(...a),
}))
const getExistingPatternIds = jest.fn()
jest.mock('@nextsparkjs/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { getExistingPatternIds: (...a: unknown[]) => getExistingPatternIds(...a) },
}))

const TEMPLATES = join(__dirname, '../../../templates')
const COPIES = ['projects/starter/entities/pages', 'features/pages/entities/pages']
const OWNER: Record<string, string> = { 'pat-A': 'team-A', 'pat-B': 'team-B' }
const ref = (id: string) => ({ type: 'pattern', ref: id, id: `ref-${id}` })
const hero = { id: 'h', blockSlug: 'hero', props: {} }

describe.each(COPIES)('PagesManagementService.create (%s)', dir => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PagesManagementService } = require(join(TEMPLATES, dir, 'pages-management.service')) as typeof import('../../../templates/projects/starter/entities/pages/pages-management.service')

  beforeEach(() => {
    mutateWithRLS.mockReset()
    mutateWithRLS.mockResolvedValue({ rows: [{ id: 'p1', slug: 's', title: 't', blocks: [], locale: 'en', status: 'draft' }] })
    getExistingPatternIds.mockReset()
    getExistingPatternIds.mockImplementation(async (ids: string[], _u: string, team: string) => new Set(ids.filter(id => OWNER[id] === team)))
  })

  const savedBlocks = () => JSON.parse(mutateWithRLS.mock.calls[0][1][5]) as unknown[]

  it('drops the reference to a pattern of another team, even one the user also belongs to', async () => {
    await PagesManagementService.create('user-1', { slug: 's', title: 't', teamId: 'team-A', blocks: [hero, ref('pat-A'), ref('pat-B')] } as never)
    expect(getExistingPatternIds).toHaveBeenCalledWith(['pat-A', 'pat-B'], 'user-1', 'team-A')
    expect(savedBlocks()).toEqual([hero, ref('pat-A')])
  })

  it('saves blocks without references as they are, and no blocks as []', async () => {
    await PagesManagementService.create('user-1', { slug: 's', title: 't', teamId: 'team-A', blocks: [hero] } as never)
    expect(savedBlocks()).toEqual([hero])
    mutateWithRLS.mockClear()
    await PagesManagementService.create('user-1', { slug: 's', title: 't', teamId: 'team-A' } as never)
    expect(savedBlocks()).toEqual([])
    expect(getExistingPatternIds).not.toHaveBeenCalled()
  })
})
