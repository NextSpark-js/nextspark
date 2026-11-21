/**
 * @jest-environment jsdom
 *
 * #518: the Fields table lists each field by its `name` (field definitions are an array, not a record), and array
 * fields expand to their subfields.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/registries/block-registry.client', () => ({ BLOCK_REGISTRY: {} }))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({ TAGS_REGISTRY: { blocks: {} } }))
jest.mock('@/core/lib/blocks/loader', () => ({ getBlockComponent: () => null }))

import { FieldRows } from '@/core/components/devtools/BlockDetailViewer'
import { groupFieldsByTab } from '@/core/components/devtools/block-field-utils'
import type { FieldDefinition } from '@/core/types/blocks'

const f = (name: string, extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ name, label: `${name} label`, type: 'text', tab: 'content', ...extra }) as FieldDefinition

describe('groupFieldsByTab', () => {
  test('groups an array of definitions by tab keeping order, content by default', () => {
    const g = groupFieldsByTab([f('a'), f('b', { tab: 'design' }), f('c', { tab: undefined as never })])
    expect(Object.keys(g)).toEqual(['content', 'design'])
    expect(g.content.map((x) => x.name)).toEqual(['a', 'c'])
  })
})

describe('FieldRows', () => {
  const renderRow = (field: FieldDefinition) =>
    render(<table><tbody><FieldRows field={field} depth={0} /></tbody></table>)

  test('shows the field name, not an index, with its label below', () => {
    renderRow(f('title'))
    expect(screen.getByText('title')).toBeTruthy()
    expect(screen.getByText('title label')).toBeTruthy()
  })

  test('array fields expand to show their subfields', () => {
    renderRow(f('items', { type: 'array', itemFields: [f('heading'), f('body')] }))
    expect(screen.queryByText('heading')).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('heading')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
  })
})
