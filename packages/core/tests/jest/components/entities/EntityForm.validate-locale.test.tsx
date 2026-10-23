/**
 * @jest-environment jsdom
 *
 * EntityForm — the form validates in the active locale (#358): with a translator built from the active messages
 * it answers from `validation.entity.*`; without one (English) the form keeps its own texts.
 */
import { describe, it, expect, jest } from '@jest/globals'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

let mockLocale = 'en'
let mockMessages: Record<string, unknown> = {}
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => mockLocale, useMessages: () => mockMessages }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({
  EntityFieldRenderer: ({ error }: { error?: string }) => (error ? <p data-testid="field-error">{error}</p> : null),
}))

import { EntityForm, validateFormData } from '@/core/components/entities/EntityForm'
import { createValidationTranslator } from '@/core/lib/entities/validation-translator'
import type { EntityConfig } from '@/core/lib/entities/types'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'

const field = (name: string, type: string, required: boolean, extra: Record<string, unknown> = {}) =>
  ({ name, type, required, api: { readOnly: false }, display: { label: name, showInForm: true, ...extra } })
const entityConfig = {
  slug: 'clients',
  fields: [field('name', 'text', true), field('mail', 'email', false), field('site', 'url', false), field('age', 'number', false), field('meta', 'json', false)],
} as unknown as EntityConfig
const bad = { mail: 'x', site: 'http://', age: 'abc', meta: '{' }

describe('validateFormData locale', () => {
  it('keeps the English texts without a translator', () => {
    expect(validateFormData(bad, entityConfig)).toEqual({
      name: 'name is required',
      mail: 'Please enter a valid email address',
      site: 'Please enter a valid URL',
      age: 'Please enter a valid number',
      meta: 'Please enter valid JSON',
    })
  })

  it('answers from the catalog of two locales', () => {
    const spanish = validateFormData(bad, entityConfig, [], createValidationTranslator(es as Record<string, unknown>))
    const german = validateFormData(bad, entityConfig, [], createValidationTranslator(de as Record<string, unknown>))
    expect(spanish.name).toBe('name es obligatorio')
    expect(spanish.mail).toBe('mail debe ser un correo electrónico válido')
    expect(german.name).not.toBe(spanish.name)
    expect(german.name).toContain('name')
    expect(Object.keys(spanish)).toEqual(Object.keys(german))
  })

  it('a message the field declares wins, and a key the catalog lacks keeps the English text', () => {
    const own = { ...entityConfig, fields: [field('name', 'text', true, { validationMessages: { required: 'Falta {label}' } })] } as unknown as EntityConfig
    expect(validateFormData({}, own, [], createValidationTranslator({}))).toEqual({ name: 'Falta name' })
    expect(validateFormData(bad, entityConfig, [], createValidationTranslator({})).mail).toBe('Please enter a valid email address')
  })
})

describe('EntityForm locale', () => {
  const submitIn = (locale: string, messages: Record<string, unknown>) => {
    mockLocale = locale
    mockMessages = messages
    const { container, unmount } = render(<EntityForm entityConfig={entityConfig} mode="create" onSubmit={async () => {}} />)
    fireEvent.submit(container.querySelector('form')!)
    return unmount
  }

  it('shows the message in the active locale', async () => {
    const unmount = submitIn('es', es as Record<string, unknown>)
    await waitFor(() => expect(screen.getAllByTestId('field-error').map(node => node.textContent)).toEqual(['name es obligatorio']))
    unmount()
  })

  it('English keeps its own text even when the English catalog is loaded', async () => {
    const unmount = submitIn('en', { validation: { entity: { required: 'CATALOG {label}' } } })
    await waitFor(() => expect(screen.getAllByTestId('field-error').map(node => node.textContent)).toEqual(['name is required']))
    unmount()
  })

  it('a message the field declares wins in English, without a translator', async () => {
    const own = { slug: 'c', fields: [field('name', 'text', true, { validationMessages: { required: 'Falta {label}' } })] } as unknown as EntityConfig
    expect(validateFormData({}, own)).toEqual({ name: 'Falta name' })
  })

  it('a regional English locale keeps the form texts', async () => {
    const unmount = submitIn('en-GB', { validation: { entity: { required: 'CATALOG {label}' } } })
    await waitFor(() => expect(screen.getAllByTestId('field-error').map(node => node.textContent)).toEqual(['name is required']))
    unmount()
  })
})
