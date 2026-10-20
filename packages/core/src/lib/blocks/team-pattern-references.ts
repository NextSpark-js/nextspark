/**
 * Pattern references are scoped to the team of the record that holds them.
 *
 * Every write path that persists `blocks` (the generic handler, the page services of the templates) filters the
 * references through here, so a record only keeps references to patterns of its own team. A pattern is owned by one
 * team (`patterns."teamId"`, not null) and there is no cross-team sharing, so "its own team" is the whole rule.
 *
 * @module core/lib/blocks/team-pattern-references
 */

import { extractPatternIds } from './pattern-resolver'
import { isPatternReference } from '../../types/pattern-reference'
import { PatternUsageService } from '../services/pattern-usage.service'

/**
 * Drop the pattern references that do not point to an existing pattern of `teamId` (deleted, or owned by another
 * team, even one the user also belongs to). Other blocks are kept as they are.
 */
export async function filterPatternReferencesToTeam(
  blocks: unknown[],
  userId: string,
  teamId: string
): Promise<unknown[]> {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks

  const patternIds = extractPatternIds(blocks as Parameters<typeof extractPatternIds>[0])
  if (patternIds.length === 0) return blocks

  const allowed = await PatternUsageService.getExistingPatternIds(patternIds, userId, teamId)
  if (allowed.size === patternIds.length) return blocks

  return blocks.filter(block => {
    if (!isPatternReference(block)) return true
    const keep = allowed.has(block.ref)
    if (!keep) console.info(`[pattern-references] Dropping PatternReference not in team: ${block.ref}`)
    return keep
  })
}
