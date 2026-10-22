/**
 * @jest-environment jsdom
 *
 * EntityForm: `hiddenFields` are fields the theme renders or fills elsewhere. They are not rendered by the form, but
 * what the form submits does not change: the initial data of a hidden field is still sent.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, waitFor, fireEvent } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({ EntityFieldRenderer: () => null }))

import { EntityForm } from '@/core/components/entities/EntityForm'
import type { EntityConfig } from '@/core/lib/entities/types'

const field = (name: string) => ({ name, type: 'text', required: false, display: { label: name, showInForm: true, showInList: true, showInDetail: true, order: 1 }, api: {} })
const entityConfig = { slug: 'clients', fields: [field('title'), field('color')], ui: { features: {} } } as unknown as EntityConfig

describe('EntityForm hiddenFields', () => {
  it('still submits the value of a hidden field in edit mode', async () => {
    const onSubmit = jest.fn(async (_data: Record<string, unknown>) => undefined)
    const { container } = render(
      <EntityForm entityConfig={entityConfig} mode="edit" initialData={{ title: 'x', color: 'red' }} hiddenFields={['color']} onSubmit={onSubmit} />
    )
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({ title: 'x', color: 'red' })
  })
})
