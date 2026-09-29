'use client'

import { useState } from 'react'
import { CLIENT_ENTITY_REGISTRY } from '@nextsparkjs/registries/entities.client'

export function EntityBadges() {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <ul data-probe="client-registry">
      {Object.values(CLIENT_ENTITY_REGISTRY).map(entity => (
        <li key={entity.name}>
          <button type="button" aria-pressed={selected === entity.name} onClick={() => setSelected(entity.name)}>
            {entity.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
