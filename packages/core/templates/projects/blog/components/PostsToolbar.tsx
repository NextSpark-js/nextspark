'use client'

import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { ExportPostsButton } from './ExportPostsButton'
import { ImportPostsDialog } from './ImportPostsDialog'

interface PostsToolbarProps {
  onRefresh?: () => void
}

export function PostsToolbar({ onRefresh }: PostsToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <PermissionGate permission="posts.export_json">
        <ExportPostsButton />
      </PermissionGate>
      
      <PermissionGate permission="posts.import_json">
        <ImportPostsDialog onImportComplete={onRefresh} />
      </PermissionGate>
    </div>
  )
}

