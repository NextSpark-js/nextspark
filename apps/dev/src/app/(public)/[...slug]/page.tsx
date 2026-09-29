// Implementation: @nextsparkjs/core/routes/(public)/[...slug]/page (#203). The project's
// per-entity template overrides are still resolved here at runtime, until the generated host
// replaces this file.
import { createDynamicPublicPage } from '@nextsparkjs/core/routes/_internal/public-catch-all-page'
import { hasTemplateOverride, getTemplateComponent } from '@nextsparkjs/registries/template-scopes/server/(public)/[...slug]/page'

export { generateMetadata } from '@nextsparkjs/core/routes/(public)/[...slug]/page'
export const revalidate = 3600

export default createDynamicPublicPage(appPath =>
  hasTemplateOverride(appPath) ? getTemplateComponent(appPath) : null
)
