/**
 * @jest-environment jsdom
 *
 * #527: "Copy tag" copies the tag and "Copy test command" the cypress command, both with a Copied toast (an error
 * toast when the clipboard refuses); Export Tokens builds a CSS or JSON file from the resolved color tokens.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({ toast }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { TagCopyActions } from '@/core/components/devtools/TagCopyActions'
import { buildTokensExport } from '@/core/components/superadmin/misc/theme-tokens'

const writeText = jest.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  toast.success.mockReset()
  toast.error.mockReset()
  writeText.mockReset().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
})

describe('TagCopyActions', () => {
  const setup = () => render(<TagCopyActions tag="@feat-billing" tagCy="tag" commandCy="cmd" />)

  test('the Copy tag action copies the tag itself and toasts', async () => {
    setup()
    fireEvent.click(screen.getByLabelText('tag'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('copied'))
    expect(writeText).toHaveBeenCalledWith('@feat-billing')
  })

  test('the Copy test command action copies the cypress command', async () => {
    setup()
    fireEvent.click(screen.getByLabelText('testCommand'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('npx cypress run --env grepTags="@feat-billing"'))
    expect(toast.success).toHaveBeenCalledWith('copied')
  })

  test('a refused clipboard shows an error toast, not a success', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    setup()
    fireEvent.click(screen.getByLabelText('tag'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('failed'))
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('buildTokensExport', () => {
  const read = (v: string) => ({ '--primary': 'oklch(0.2 0 0)', '--border': '#ddd' })[v] ?? ''

  test('css is a :root block of the resolved values', () => {
    expect(buildTokensExport(['--primary', '--border'], read, 'css')).toBe(
      ':root {\n  --primary: oklch(0.2 0 0);\n  --border: #ddd;\n}\n'
    )
  })

  test('json is an object keyed by variable name', () => {
    expect(JSON.parse(buildTokensExport(['--primary', '--border'], read, 'json'))).toEqual({
      '--primary': 'oklch(0.2 0 0)',
      '--border': '#ddd',
    })
  })
})
