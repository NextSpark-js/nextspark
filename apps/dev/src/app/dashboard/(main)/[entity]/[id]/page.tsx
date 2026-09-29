// Implementation: @nextsparkjs/core/routes/dashboard/(main)/[entity]/[id]/page (#203). The
// project's per-entity template overrides are still resolved here at runtime, until the
// generated host replaces this file.
import { createEntityDetailPage } from '@nextsparkjs/core/routes/_internal/entity-detail-page'
import { hasTemplateOverride, getTemplateComponent } from '@nextsparkjs/registries/template-scopes/server/dashboard/(main)/[entity]/[id]/page'

export { metadata } from '@nextsparkjs/core/routes/dashboard/(main)/[entity]/[id]/page'

export default createEntityDetailPage(appPath =>
  hasTemplateOverride(appPath) ? getTemplateComponent(appPath) : null
)
