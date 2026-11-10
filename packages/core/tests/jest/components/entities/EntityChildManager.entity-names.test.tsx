/**
 * @jest-environment jsdom
 *
 * The empty child section names the parent and the children inside a sentence (#421): in lower case, except in
 * German, where nouns keep their capital.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let mockLocale = 'es'
let mockMessages: Record<string, unknown> = {}
const mockTranslators = new Map<string, unknown>()
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useMessages: () => mockMessages,
  useTranslations: (namespace = '') => {
    const key = `${mockLocale}:${namespace}`
    if (!mockTranslators.has(key)) {
      const read = (k: string) => `${namespace}.${k}`.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), mockMessages)
      const t = (k: string, values: Record<string, unknown> = {}) => {
        const message = read(k)
        return typeof message === 'string' ? message.replace(/\{(\w+)\}/g, (_: string, name: string) => String(values[name] ?? '')) : `${namespace}.${k}`
      }
      t.has = (k: string) => typeof read(k) === 'string'
      mockTranslators.set(key, t)
    }
    return mockTranslators.get(key)
  },
}))

jest.mock('@/core/components/entities/EntityForm', () => ({ EntityForm: () => null }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({ EntityFieldRenderer: () => null }))

import { EntityChildManager } from '@/core/components/entities/EntityChildManager'
import esCore from '@/core/messages/es/index'
import deCore from '@/core/messages/de/index'
import type { ChildEntityDefinition, EntityConfig } from '@/core/lib/entities/types'

const parent = (singular: string) => ({ slug: 'projects', names: { singular, plural: singular }, icon: () => null, fields: [] }) as unknown as EntityConfig
const child = (title: string) => ({ fields: [], display: { title, mode: 'table' } }) as unknown as ChildEntityDefinition

test.each([
  ['es', esCore, 'Proyecto', 'Tareas', 'Este proyecto todavía no tiene tareas.'],
  ['de', deCore, 'Projekt', 'Aufgaben', 'Dieser Eintrag (Projekt) hat noch keine Aufgaben.'],
])('in %s', (locale, core, parentName, childTitle, sentence) => {
  mockLocale = locale
  mockMessages = core as Record<string, unknown>
  render(<EntityChildManager parentEntityConfig={parent(parentName)} parentEntityId="p1" childEntityName="tasks" childEntityConfig={child(childTitle)} childData={[]} />)
  expect(screen.getByText(sentence)).toBeTruthy()
})
