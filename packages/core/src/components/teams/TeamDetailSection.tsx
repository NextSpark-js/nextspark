'use client'

/**
 * Team Members Section Component
 *
 * Custom section for team detail pages that displays team members
 * with invite functionality. Designed to be used within EntityDetail.
 */

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { TeamMembersList } from './TeamMembersList'
import { TeamPendingInvitations } from './TeamPendingInvitations'

interface TeamDetailSectionProps {
  /**
   * The team ID to display members for
   */
  teamId: string
}

export function TeamDetailSection({ teamId }: TeamDetailSectionProps) {
  const t = useTranslations('teams')
  return (
    <Card data-cy="team-members-section">
      <CardHeader>
        <CardTitle>{t('members.title')}</CardTitle>
        <CardDescription>
          {t('members.sectionDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TeamMembersList teamId={teamId} />
        <TeamPendingInvitations teamId={teamId} />
      </CardContent>
    </Card>
  )
}
