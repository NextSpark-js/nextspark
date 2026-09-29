/**
 * Login page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; `dynamic = 'force-dynamic'` is left out because Next.js fails a build that
 * has it under Cache Components. The form is a Client Component, so the page needs no per-request
 * render.
 */
export { default, metadata } from './page'
