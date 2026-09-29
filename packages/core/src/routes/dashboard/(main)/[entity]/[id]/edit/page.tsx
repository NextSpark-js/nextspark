'use client'

import { useParams } from 'next/navigation'
import { EntityEditView } from '../../../../../_internal/entity-edit-view'

function EntityEditPage() {
  const params = useParams()!
  return <EntityEditView entity={params.entity as string} id={params.id as string} />
}

export default EntityEditPage
