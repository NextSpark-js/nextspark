import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entities.server'
import { EntityBadges } from '@/components/EntityBadges'

export default function RegistryPage() {
  return (
    <div>
      <p data-probe="server-registry">{Object.values(ENTITY_REGISTRY).map(entity => entity.table).join(',')}</p>
      <EntityBadges />
    </div>
  )
}
