/**
 * @jest-environment node
 *
 * The blog's public layout is part of every public page's prerendered shell. Nothing in it may read the clock
 * uncached while it renders: with Cache Components that stops the whole layout from rendering on the server, the public
 * pages were rendered in the browser only, and a page with request-time content (a post) got React error #419 (#493).
 * The copyright year is read in a cached server component and handed to the client footer as a prop.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePathIfInApp: (p: string) => p }))

import { BlogFooter } from '../../../templates/projects/blog/components/public/BlogFooter'

const blog = join(__dirname, '../../../templates/projects/blog')
const source = (file: string) => readFileSync(join(blog, file), 'utf8')

test('the copyright year is read in a cached function', () => {
  expect(source('components/public/CopyrightYear.tsx')).toMatch(/export async function CopyrightYear\(\)\s*\{\s*'use cache'\n/)
})

test('the public layout is a server component that hands the year to the footer', () => {
  const layout = source('templates/(public)/layout.tsx')
  expect(layout).not.toMatch(/^\s*['"]use client['"]/m)
  expect(layout).toMatch(/year=\{<CopyrightYear \/>\}/)
})

test('the footer does not read the clock and renders the year it is given', () => {
  expect(source('components/public/BlogFooter.tsx')).not.toMatch(/new Date\(|Date\.now\(/)
  expect(renderToStaticMarkup(<BlogFooter blogTitle="My Blog" year={2031} />)).toContain('© 2031 My Blog. All rights reserved.')
})
