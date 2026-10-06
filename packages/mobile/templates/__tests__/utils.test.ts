import { cn } from '../src/lib/utils'

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('p-2', false, undefined, 'text-sm')).toBe('p-2 text-sm')
  })

  it('lets the later Tailwind class win a conflict', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
