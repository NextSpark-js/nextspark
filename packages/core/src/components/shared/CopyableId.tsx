'use client'

/**
 * CopyableId Component
 *
 * Displays a truncated entity ID with a copy-to-clipboard button.
 * Shows visual feedback when the ID is copied.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { sel } from '../../lib/test'

interface CopyableIdProps {
  /** The full ID to copy */
  id: string
  /** Number of characters to show (default: 8) */
  truncateAt?: number
  /** Entity slug for data-cy generation (e.g., "customers", "teams") */
  entitySlug?: string
  /** Optional custom className */
  className?: string
}

export function CopyableId({
  id,
  truncateAt = 8,
  entitySlug,
  className
}: CopyableIdProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayId = id.length > truncateAt ? `${id.slice(0, truncateAt)}...` : id

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${className || ''}`}
      data-cy={entitySlug ? sel('entities.detail.copyId', { slug: entitySlug }) : sel('entities.detail.copyId', { slug: 'generic' })}
    >
      <span className="font-mono">ID: {displayId}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  )
}
