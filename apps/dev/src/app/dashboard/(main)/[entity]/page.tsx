// Implementation: @nextsparkjs/core/routes/dashboard/(main)/[entity]/page (#203). The project's
// template overrides (this route, and one per entity) are still resolved here at runtime, until
// the generated host replaces this file.
import { createEntityListPage, type EntityListPageProps } from '@nextsparkjs/core/routes/_internal/entity-list-page'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/(main)/[entity]/page'

export { metadata } from '@nextsparkjs/core/routes/dashboard/(main)/[entity]/page'

const EntityListPage = createEntityListPage(
  appPath => getTemplateOrDefault(appPath, null) as React.ComponentType<EntityListPageProps> | null
)

export default getTemplateOrDefault('app/dashboard/(main)/[entity]/page.tsx', EntityListPage)
