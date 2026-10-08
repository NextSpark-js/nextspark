/**
 * Signup page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; `dynamic = 'force-dynamic'` is left out because Next.js fails a build that
 * has it under Cache Components. The page reads the database and calls redirect(), so it sits in its own
 * Suspense boundary: the redirect streams per request, after the static shell (the group layout already did
 * that), and the dev server's instant-navigation check, which cannot render a page that redirects, finds
 * the boundary between the page and the segment it validates.
 */
import { Suspense } from 'react'
import SignupPage, { metadata } from './page'

export { metadata }

export default function SignupPageCc({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={null}>
      <SignupPage searchParams={searchParams} />
    </Suspense>
  )
}
