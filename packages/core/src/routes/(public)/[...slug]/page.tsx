/**
 * Public Dynamic Catch-All Route
 *
 * Handles all public URLs for builder-enabled entities based on access.basePath
 * configuration. The implementation is in ../../_internal/public-catch-all-page.
 */

import { createDynamicPublicPage } from '../../_internal/public-catch-all-page'

export { generateMetadata } from '../../_internal/public-catch-all-page'

// Enable ISR with 1 hour revalidation
// On Next.js 16 with cacheComponents, this is superseded by 'use cache' + cacheLife()
export const revalidate = 3600

export default createDynamicPublicPage()
