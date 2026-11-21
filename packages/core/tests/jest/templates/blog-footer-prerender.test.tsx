/**
 * @jest-environment node
 *
 * The blog footer is in the public layout, so it is part of every public page's prerendered shell. It must not read the
 * clock while it renders on the server: with Cache Components that stops the whole layout from rendering on the server,
 * the public pages were rendered in the browser only, and a page with request-time content (a post) got React error
 * #419 (#493). The year is read in the browser.
 */
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePathIfInApp: (p: string) => p }))

import { BlogFooter } from '../../../templates/projects/blog/components/public/BlogFooter'

test('the server render does not read the clock', () => {
  const RealDate = Date
  const now = jest.fn(() => { throw new Error('the clock was read during the server render') })
  // new Date() with no arguments and Date.now() are the reads Next.js refuses while prerendering
  global.Date = class extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) now()
      super(...args)
    }
    static now = now
  } as DateConstructor
  try {
    const html = renderToStaticMarkup(<BlogFooter blogTitle="My Blog" />)
    expect(html).toContain('My Blog. All rights reserved.')
    expect(now).not.toHaveBeenCalled()
  } finally {
    global.Date = RealDate
  }
})
