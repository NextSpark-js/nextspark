import { generateEntitySchemas } from '@/core/lib/entities/schema-generator'
import type { EntityConfig } from '@/core/lib/entities/types'

const entityWith = (defaultValue: unknown): EntityConfig =>
  ({
    slug: 'things',
    names: { singular: 'thing', plural: 'Things' },
    fields: [{ name: 'note', type: 'text', required: false, defaultValue, display: { label: 'Note' }, api: {} }],
  }) as unknown as EntityConfig

describe('a text field that is empty takes its defaultValue as a string (#399)', () => {
  it('a null default stays null for "" and null, not the string "null"', () => {
    const { create } = generateEntitySchemas(entityWith(null))
    expect(create.parse({ note: '' })).toEqual({ note: null })
    expect(create.parse({ note: null })).toEqual({ note: null })
  })

  it("a '' default and a number default are still written as strings", () => {
    expect(generateEntitySchemas(entityWith('')).create.parse({ note: null })).toEqual({ note: '' })
    expect(generateEntitySchemas(entityWith(5)).create.parse({ note: '' })).toEqual({ note: '5' })
  })
})
