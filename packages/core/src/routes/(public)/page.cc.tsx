/**
 * The default public home for a host with `cacheComponents` on (variant of ./page): the same redirect, behind a
 * Suspense boundary. A page that only redirects cannot be rendered by Next.js's instant-navigation check (dev), which logs
 * "Could not validate `instant`" for "/" otherwise; the redirect streams per request after the shell, as the group layout
 * already made it.
 */
import { behindSuspense } from '../_internal/suspended-route'
import DefaultPublicHome from './page'

export default behindSuspense(DefaultPublicHome)
