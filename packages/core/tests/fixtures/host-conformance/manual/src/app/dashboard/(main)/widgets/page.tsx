import NextSparkTemplate from "@/templates/dashboard/(main)/widgets/page"
import { widgetsEntityConfig } from "@/entities/widgets/widgets.config"
import { createEntityListRoute } from "@fixture-core/app/entity/list-route"
export default createEntityListRoute(widgetsEntityConfig, NextSparkTemplate)
export { generateMetadata } from "@fixture-core/app/entity/list-page"
