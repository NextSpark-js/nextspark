/**
 * The starter's task helpers compare with the values the `status` field stores (`in-progress`, with a hyphen), so tasks
 * in progress are counted and coloured (#418).
 */
import { calculateTaskStats, getStatusColor } from '../../../templates/projects/starter/lib/utils'

describe('starter task helpers', () => {
  it('counts the in-progress tasks', () => {
    const stats = calculateTaskStats([
      { status: 'todo' },
      { status: 'in-progress' },
      { status: 'in-progress' },
      { status: 'done' },
    ])
    expect(stats).toMatchObject({ total: 4, todo: 1, inProgress: 2, completed: 1, completionRate: 25 })
  })

  it('colours an in-progress task as in progress, not as the default', () => {
    expect(getStatusColor('in-progress')).toContain('text-blue-600')
    expect(getStatusColor('in-progress')).not.toBe(getStatusColor('unknown'))
  })

  it('colours a blocked task in red, since "blocked" is a stored status and "cancelled" is not', () => {
    expect(getStatusColor('blocked')).toContain('text-red-600')
    expect(getStatusColor('cancelled')).not.toContain('text-red-600')
  })
})
