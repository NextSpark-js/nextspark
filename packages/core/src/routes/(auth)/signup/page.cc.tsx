/**
 * Signup page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; `dynamic = 'force-dynamic'` is left out because Next.js fails a build that
 * has it under Cache Components. The page reads the database and calls redirect(); under Cache Components
 * the group or root layout puts it behind Suspense, so the redirect streams per request, after the static shell.
 */
export { default, metadata } from './page'
