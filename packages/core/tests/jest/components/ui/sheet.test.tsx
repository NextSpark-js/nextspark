/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet'

const RADIX_MISSING_DESCRIPTION = 'Missing `Description`'

function renderOpenSheet(content: ReactNode) {
  return render(
    <Sheet open onOpenChange={() => {}}>
      {content}
    </Sheet>
  )
}

function getDialog() {
  return screen.getByRole('dialog')
}

function getCloseButton() {
  return screen.getByRole('button', { name: /close/i })
}

describe('Sheet', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    cleanup()
  })

  const missingDescriptionWarnings = () =>
    warnSpy.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes(RADIX_MISSING_DESCRIPTION)
    )

  describe('Description fallback (#113)', () => {
    test('does not trigger the Radix "Missing Description" warning when no SheetDescription is passed', () => {
      renderOpenSheet(
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Sort</SheetTitle>
          </SheetHeader>
        </SheetContent>
      )

      expect(missingDescriptionWarnings()).toHaveLength(0)
    })

    test('renders a visually hidden fallback description that aria-describedby resolves to', () => {
      renderOpenSheet(
        <SheetContent>
          <SheetTitle>Sort</SheetTitle>
        </SheetContent>
      )

      const dialog = getDialog()
      const describedById = dialog.getAttribute('aria-describedby')
      expect(describedById).toBeTruthy()

      const description = document.getElementById(describedById as string)
      expect(description).not.toBeNull()
      expect(dialog).toContainElement(description)
      expect(description).toHaveClass('sr-only')
    })

    test('uses the consumer SheetDescription instead of the fallback when one is provided', () => {
      renderOpenSheet(
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sort</SheetTitle>
            <SheetDescription>Choose how the list is ordered</SheetDescription>
          </SheetHeader>
        </SheetContent>
      )

      const describedById = getDialog().getAttribute('aria-describedby') as string
      const matches = document.querySelectorAll(`[id="${describedById}"]`)

      expect(matches).toHaveLength(1)
      expect(matches[0]).toHaveTextContent('Choose how the list is ordered')
      expect(matches[0]).not.toHaveClass('sr-only')
      expect(missingDescriptionWarnings()).toHaveLength(0)
    })
  })

  describe('Close button tap target (#117)', () => {
    test('renders the default close button with a 44x44 hit area', () => {
      renderOpenSheet(
        <SheetContent>
          <SheetTitle>Sort</SheetTitle>
        </SheetContent>
      )

      expect(getCloseButton()).toHaveClass('h-11', 'w-11')
    })

    test('merges closeButtonClassName onto the close button (tailwind-merge resolves conflicts)', () => {
      renderOpenSheet(
        <SheetContent closeButtonClassName="right-2 top-2 text-red-500">
          <SheetTitle>Sort</SheetTitle>
        </SheetContent>
      )

      const closeButton = getCloseButton()
      expect(closeButton).toHaveClass('right-2', 'top-2', 'text-red-500')
      expect(closeButton).not.toHaveClass('right-0.5', 'top-0.5')
    })

    test('does not leak closeButtonClassName onto the content element', () => {
      renderOpenSheet(
        <SheetContent closeButtonClassName="text-red-500">
          <SheetTitle>Sort</SheetTitle>
        </SheetContent>
      )

      const dialog = getDialog()
      expect(dialog).not.toHaveClass('text-red-500')
      expect(dialog).not.toHaveAttribute('closeButtonClassName')
      expect(dialog).not.toHaveAttribute('closebuttonclassname')
    })
  })
})
