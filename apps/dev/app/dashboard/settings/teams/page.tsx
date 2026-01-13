'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, Plus, Settings, ChevronRight, Crown, Shield, Eye, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@nextsparkjs/core/components/ui/avatar'
import { Separator } from '@nextsparkjs/core/components/ui/separator'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { useTeamsConfig } from '@nextsparkjs/core/hooks/useTeamsConfig'
import { TeamMembersList } from '@nextsparkjs/core/components/teams/TeamMembersList'
import { TeamPendingInvitations } from '@nextsparkjs/core/components/teams/TeamPendingInvitations'
import { CreateTeamDialog } from '@nextsparkjs/core/components/teams/CreateTeamDialog'
import { InlineEditableField } from '@nextsparkjs/core/components/teams/InlineEditableField'
import { sel } from '@nextsparkjs/core/selectors'
import { TeamRole } from '@nextsparkjs/core/lib/teams/types'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

// Role icons map - core roles only, custom roles use fallback
const roleIconsMap: Record<string, typeof Crown | null> = {
  owner: Crown,
  admin: Shield,
  member: null,
  viewer: Eye,
}

// Role colors map - core roles only, custom roles use fallback
const roleColorsMap: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  owner: 'destructive',
  admin: 'default',
  member: 'secondary',
  viewer: 'outline',
}

// Type-safe helpers - fallback handles any custom theme roles
const getRoleIcon = (role: TeamRole) => roleIconsMap[role] ?? Eye
const getRoleColor = (role: TeamRole) => roleColorsMap[role] ?? 'outline'

function TeamsSettingsPage() {
  const t = useTranslations('settings')
  const tTeams = useTranslations('teams')
  const { userTeams, currentTeam, isLoading } = useTeamContext()
  const { mode, canCreate, canSwitch } = useTeamsConfig()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // In single-user mode, hide the teams settings page content
  // since there's only one team and no collaboration features
  const isSingleUserMode = mode === 'single-user'

  // Find selected team membership
  const selectedMembership = selectedTeamId
    ? userTeams.find(m => m.team.id === selectedTeamId)
    : null

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 gap-3"
        role="status"
        aria-label={tTeams('messages.loading')}
        data-cy={sel('settings.teams.loading')}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {tTeams('messages.loading')}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="max-w-4xl space-y-6"
        data-cy={sel('settings.teams.container')}
      >
        {/* Header */}
        <header data-cy={sel('settings.teams.header')}>
          <h1
            className="text-2xl font-bold"
            id="teams-settings-heading"
          >
            {t('teams.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('teams.description')}
          </p>
        </header>

        {/* Single-user mode: show simplified view */}
        {isSingleUserMode && currentTeam && (
          <Card data-cy={sel('settings.teams.singleUserMode')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" aria-hidden="true" />
                <CardTitle>{t('teams.yourTeam')}</CardTitle>
              </div>
              <CardDescription>
                {t('teams.singleUserDescription', { fallback: 'Your personal workspace.' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentTeam.avatarUrl || undefined} alt={currentTeam.name} />
                  <AvatarFallback>
                    {currentTeam.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{currentTeam.name}</div>
                  <div className="text-sm text-muted-foreground">{currentTeam.slug}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teams List Card - only show if not single-user mode */}
        {!isSingleUserMode && (
        <Card data-cy={sel('settings.teams.list.container')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" aria-hidden="true" />
                <CardTitle>{canSwitch ? t('teams.yourTeams') : t('teams.yourTeam')}</CardTitle>
              </div>
              {/* Only show Create Team button if mode allows it */}
              {canCreate && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                  data-cy="create-team-button"
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  {tTeams('actions.create')}
                </Button>
              )}
            </div>
            <CardDescription>
              {t('teams.yourTeamsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('teams.noTeams')}
                </div>
              ) : (
                userTeams.map((membership) => {
                  const team = membership.team
                  const role = membership.role as TeamRole
                  const RoleIcon = getRoleIcon(role)
                  const isSelected = selectedTeamId === team.id

                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(isSelected ? null : team.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-accent/50 ${
                        isSelected ? 'bg-accent border-accent' : 'border-border'
                      }`}
                      data-cy={`team-item-${team.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={team.avatarUrl || undefined} alt={team.name} />
                          <AvatarFallback>
                            {team.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{team.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {team.slug}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getRoleColor(role)}>
                          {RoleIcon && <RoleIcon className="h-3 w-3 mr-1" aria-hidden="true" />}
                          {tTeams(`roles.${role}`)}
                        </Badge>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Selected Team Details - only show if not single-user mode */}
        {!isSingleUserMode && selectedMembership && (
          <Card data-cy={sel('settings.teams.list.details', { id: selectedMembership.team.id })}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" aria-hidden="true" />
                <CardTitle className="flex-1">
                  <InlineEditableField
                    value={selectedMembership.team.name}
                    fieldType="name"
                    teamId={selectedMembership.team.id}
                    placeholder={tTeams('createTeam.namePlaceholder')}
                    disabled={selectedMembership.role !== 'owner'}
                  />
                </CardTitle>
              </div>
              <CardDescription className="mt-2">
                <InlineEditableField
                  value={selectedMembership.team.description}
                  fieldType="description"
                  teamId={selectedMembership.team.id}
                  placeholder={tTeams('createTeam.descriptionPlaceholder')}
                  multiline={true}
                  disabled={selectedMembership.role !== 'owner'}
                />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {tTeams('fields.slug')}
                  </label>
                  <p className="mt-1">{selectedMembership.team.slug}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {tTeams('fields.role')}
                  </label>
                  <div className="mt-1">
                    <Badge variant={getRoleColor(selectedMembership.role as TeamRole)}>
                      {tTeams(`roles.${selectedMembership.role}`)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Team Members */}
              <TeamMembersList teamId={selectedMembership.team.id} />

              {/* Pending Invitations */}
              <TeamPendingInvitations teamId={selectedMembership.team.id} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Team Dialog - only render if mode allows team creation */}
      {canCreate && (
        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/teams/page.tsx', TeamsSettingsPage)
