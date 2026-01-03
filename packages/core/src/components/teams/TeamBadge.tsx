'use client'

import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '../ui/badge'
import { Team } from '../../lib/teams/types'

interface TeamBadgeProps {
  team: Team
  showName?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function TeamBadge({ team, showName = true, size = 'md' }: TeamBadgeProps) {
  const t = useTranslations('teams')

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <Badge
      variant="default"
      className="gap-1"
    >
      <Users className={sizeClasses[size]} aria-hidden="true" />
      {showName && <span>{team.name}</span>}
    </Badge>
  )
}
