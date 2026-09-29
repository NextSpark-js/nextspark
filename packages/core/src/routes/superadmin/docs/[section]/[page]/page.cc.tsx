/**
 * Superadmin documentation page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; `dynamicParams = false` is left out because Next.js fails a build that has
 * it under Cache Components. A section/page pair that is not listed renders on demand and answers
 * notFound(); the proxy already answers 404 for a missing docs page before anything renders. Cache
 * Components needs generateStaticParams to return at least one pair, so a project with no superadmin
 * docs returns a placeholder that no page matches.
 */
import { generateStaticParams as listDocsParams } from './page'

export { default, generateMetadata } from './page'

export async function generateStaticParams() {
  const params = await listDocsParams()
  return params.length > 0 ? params : [{ section: '_', page: '_' }]
}
