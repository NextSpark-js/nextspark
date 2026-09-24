import { SkeletonFeaturePlaceholder } from '@nextsparkjs/core/components/ui/skeleton-features'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/features/loading'

function FeaturesLoading() {
  return <SkeletonFeaturePlaceholder />
}

export default getTemplateOrDefault('app/dashboard/features/loading.tsx', FeaturesLoading)
