import { widgetsEntityConfig } from "@/entities/widgets/widgets.config"
import { createEntityDetailRoute } from "@fixture-core/app/entity/detail-route"
export default createEntityDetailRoute(widgetsEntityConfig, [])
export { generateMetadata } from "@fixture-core/app/entity/detail-page"
