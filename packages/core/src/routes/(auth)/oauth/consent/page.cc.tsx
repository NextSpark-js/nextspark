/**
 * Consent page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; `dynamic = 'force-dynamic'` is left out because Next.js fails a build that has it under
 * Cache Components. The screen is a Client Component that reads the URL, so the page needs no per-request render.
 * Spike limit: without it MCP_OAUTH_ENABLED is read when the page is prerendered, so such a host has to build with
 * the value it runs with.
 */
export { default, generateMetadata } from './page'
