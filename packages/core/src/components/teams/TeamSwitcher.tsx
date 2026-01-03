'use client'

import { useState } from 'react'
import { ChevronDown, Plus, Users, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { useTeamContext } from '../../contexts/TeamContext'
import { useTeamsConfig } from '../../hooks/useTeamsConfig'
import { CreateTeamDialog } from './CreateTeamDialog'
import { cn } from '../../lib/utils'

interface TeamSwitcherProps {
  className?: string
}

export function TeamSwitcher({ className }: TeamSwitcherProps) {
  const t = useTranslations('teams')
  const { currentTeam, userTeams, switchTeam, isLoading } = useTeamContext()
  const { canSwitch, canCreate } = useTeamsConfig()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Don't render if team switching is disabled for this mode
  // (only shown in multi-tenant mode)
  if (!canSwitch) {
    return null
  }

  if (isLoading) {
    return (
      <div className={cn('h-10 w-48 bg-muted animate-pulse rounded-md', className)} />
    )
  }

  if (!currentTeam) {
    return null
  }

  const getTeamInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-between gap-2', className)}
            data-cy="team-switcher"
            aria-label={t('actions.switch')}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Avatar className="h-6 w-6">
                <AvatarImage src={currentTeam.avatarUrl || undefined} alt={currentTeam.name} />
                <AvatarFallback className="text-xs">
                  {getTeamInitials(currentTeam.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{currentTeam.name}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* All Teams - Simple flat list */}
          {userTeams.map(membership => {
            const isActive = currentTeam.id === membership.team.id

            return (
              <DropdownMenuItem
                key={membership.team.id}
                onClick={() => switchTeam(membership.team.id)}
                className="cursor-pointer"
                data-cy={`team-option-${membership.team.slug}`}
              >
                <Users className="mr-2 h-4 w-4" aria-hidden="true" />
                <div className="flex-1 flex flex-col">
                  <span>{membership.team.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`roles.${membership.role}`)}
                  </span>
                </div>
                {isActive && <Check className="h-4 w-4" aria-label={t('actions.switch')} />}
              </DropdownMenuItem>
            )
          })}

          {/* Create Team - only show if mode allows team creation */}
          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCreateDialog(true)}
                className="cursor-pointer"
                data-cy="create-team-button"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('actions.create')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTeamDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  )
}
