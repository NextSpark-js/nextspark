/**
 * @jest-environment jsdom
 */

/**
 * #396: the labels only a screen reader announces (the close button of Sheet and Dialog, the Toaster region) come from
 * the active locale's `common` messages; without a provider, or without the key, they stay what they were.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { render, screen, cleanup } from '@testing-library/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/core/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/core/components/ui/sheet'
import { Toaster } from '@/core/components/ui/sonner'
import { readCommonText } from '@/core/lib/i18n/common-text'
import es from '@/core/messages/es/index'

// next-intl is ESM only: this stand-in is what useMessages does with and without a provider
let messagesInScope: Record<string, unknown> | null = null
jest.mock('next-intl', () => ({
  useMessages: () => {
    if (!messagesInScope) throw new Error('No intl context found')
    return messagesInScope
  },
}))
jest.mock('@/core/providers/theme-provider', () => ({ useTheme: () => ({ theme: 'light' }) }))

const spanish = (children: React.ReactElement) => {
  messagesInScope = { common: es.common }
  return children
}

const sheet = (props: { closeLabel?: string } = {}) => (
  <Sheet open>
    <SheetContent {...props}>
      <SheetTitle>t</SheetTitle>
      <SheetDescription>d</SheetDescription>
    </SheetContent>
  </Sheet>
)

const dialog = (props: { closeLabel?: string } = {}) => (
  <Dialog open>
    <DialogContent {...props}>
      <DialogTitle>t</DialogTitle>
      <DialogDescription>d</DialogDescription>
    </DialogContent>
  </Dialog>
)

afterEach(() => {
  cleanup()
  messagesInScope = null
})

describe.each([['Sheet', sheet], ['Dialog', dialog]])('%s close button', (_name, build) => {
  test("is announced in the active locale's language", () => {
    render(spanish(build()))
    expect(screen.getByRole('button', { name: es.common.buttons.close })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  test('is "Close" with no provider', () => {
    render(build())
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  test('is "Close" when the messages in scope carry no common namespace', () => {
    messagesInScope = { permissions: {} }
    render(build())
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  test('takes closeLabel over the messages', () => {
    render(spanish(build({ closeLabel: 'Dismiss' })))
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })
})

describe('Toaster region', () => {
  const region = () => document.querySelector('section[aria-label]')?.getAttribute('aria-label')

  test("is named in the active locale's language", () => {
    render(spanish(<Toaster />))
    expect(region()).toContain(es.common.notifications.title)
    expect(region()).not.toContain('Notifications')
  })

  test('is "Notifications" with no provider, and takes the label the root layout passes', () => {
    render(<Toaster />)
    expect(region()).toContain('Notifications')
    cleanup()
    render(<Toaster containerAriaLabel="Avisos" />)
    expect(region()).toContain('Avisos')
  })
})

describe('readCommonText', () => {
  test('reads a string and nothing else', () => {
    expect(readCommonText({ common: { buttons: { close: 'Cerrar' } } }, 'buttons', 'close')).toBe('Cerrar')
    expect(readCommonText({ common: { buttons: {} } }, 'buttons', 'close')).toBeUndefined()
    expect(readCommonText(undefined, 'buttons', 'close')).toBeUndefined()
  })
})
