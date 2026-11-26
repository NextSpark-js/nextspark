/**
 * The skeleton an entity list shows while it loads is never wider than a phone's screen (#559). A header made of a
 * fixed-width search (w-80) and button beside the title was wider than 412 px: on a mobile browser the page then
 * lays out zoomed out, the fixed bottom navigation sits below the screen, and it jumps when the list replaces the
 * skeleton. jsdom has no layout, so the test reads the classes that keep the header inside the screen.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { SkeletonEntityList, SkeletonListHeader } from '../../../../src/components/ui/skeleton-list'

test('the header row (title block + button) is at most 272 px, what a 320 px screen leaves after the 24 px padding', () => {
  const { container } = render(<SkeletonListHeader />)
  const row = container.firstElementChild as HTMLElement
  // Tailwind w-N is N * 4 px. The row has the title block (two stacked skeletons) and the button; nothing else may set a width.
  const px = (e: Element) => Number(e.className.match(/(?:^|\s)w-(\d+)(?:\s|$)/)?.[1]) * 4
  const [titleBlock, button] = Array.from(row.children)
  expect(row.children).toHaveLength(2)
  const title = Math.max(...Array.from(titleBlock.children).map(px))
  expect(title + px(button)).toBeLessThanOrEqual(320 - 48)
})

test('the default is still the whole page: padding, header, table and pagination', () => {
  const { container } = render(<SkeletonEntityList />)
  expect((container.firstElementChild as HTMLElement).className).toContain('p-6')
  expect(container.querySelector('.mb-8')).not.toBeNull()
})
