/**
 * @jest-environment jsdom
 *
 * EntityForm — a field in `hiddenFields` is rendered elsewhere by the theme, so it must not be validated
 * by the form (an error on an invisible field made submit fail silently).
 */
import { describe, it, expect, jest } from '@jest/globals'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({ EntityFieldRenderer: () => null }))

import { validateFormData } from '@/core/components/entities/EntityForm'
import type { EntityConfig } from '@/core/lib/entities/types'

const field = (name: string, required: boolean) => ({ name, type: 'text', required, display: { label: name, showInForm: true } })
const entityConfig = { slug: 'clients', fields: [field('name', true), field('owner', true), field('notes', false)] } as unknown as EntityConfig

describe('validateFormData hiddenFields', () => {
  it('skips a required field that is hidden', () => {
    expect(validateFormData({ name: 'Acme' }, entityConfig, ['owner'])).toEqual({})
  })

  it('still fails a visible required field', () => {
    expect(validateFormData({ owner: 'x' }, entityConfig, ['owner'])).toEqual({ name: 'name is required' })
  })

  it('validates every field when nothing is hidden', () => {
    expect(Object.keys(validateFormData({}, entityConfig))).toEqual(['name', 'owner'])
  })
})
