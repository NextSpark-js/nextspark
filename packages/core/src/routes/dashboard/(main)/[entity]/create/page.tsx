'use client'

import { useParams } from 'next/navigation'
import { EntityCreateView } from '../../../../_internal/entity-create-view'

function EntityCreatePage() {
  const params = useParams()!
  return <EntityCreateView entity={params.entity as string} />
}

export default EntityCreatePage
