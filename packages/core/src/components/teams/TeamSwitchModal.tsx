'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Progress } from '../ui/progress'
import { cn } from '../../lib/utils'
import type { Team } from '../../lib/teams/types'

interface TeamSwitchModalProps {
  isOpen: boolean
  fromTeam: Team | null
  toTeam: Team | null
  onComplete: () => void
}

/**
 * TeamSwitchModal - Animated modal for team switching transition
 *
 * Shows a visual transition when the user switches between teams,
 * providing clear feedback and triggering data reload.
 */
export function TeamSwitchModal({
  isOpen,
  fromTeam,
  toTeam,
  onComplete,
}: TeamSwitchModalProps) {
  const t = useTranslations('teams')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'switching' | 'complete'>('switching')

  // Animation sequence
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setProgress(0)
      setPhase('switching')
      return
    }

    // Start progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        // Accelerate progress as it gets closer to completion
        const increment = prev < 60 ? 8 : prev < 85 ? 5 : 3
        return Math.min(prev + increment, 100)
      })
    }, 50)

    // Mark as complete after progress reaches 100
    const completeTimer = setTimeout(() => {
      setPhase('complete')
    }, 800)

    // Auto-close and trigger reload
    const closeTimer = setTimeout(() => {
      onComplete()
    }, 1400)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(completeTimer)
      clearTimeout(closeTimer)
    }
  }, [isOpen, onComplete])

  const getTeamInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!toTeam) return null

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-cy="team-switch-modal"
      >
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Title */}
          <DialogTitle className="text-center text-xl">
            {phase === 'switching' ? t('switcher.switchingTo') : t('switcher.switchComplete')}
          </DialogTitle>

          {/* Team transition visualization */}
          <div className="flex items-center justify-center gap-4">
            {/* From Team */}
            {fromTeam && (
              <>
                <div
                  className={cn(
                    'flex flex-col items-center gap-2 transition-all duration-500',
                    phase === 'switching' ? 'opacity-60 scale-90' : 'opacity-30 scale-75'
                  )}
                >
                  <Avatar className="h-14 w-14 border-2 border-muted">
                    <AvatarImage src={fromTeam.avatarUrl || undefined} alt={fromTeam.name} />
                    <AvatarFallback className="text-lg bg-muted">
                      {getTeamInitials(fromTeam.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground max-w-[80px] truncate">
                    {fromTeam.name}
                  </span>
                </div>

                {/* Animated arrow */}
                <div
                  className={cn(
                    'transition-all duration-500',
                    phase === 'switching'
                      ? 'animate-pulse text-primary'
                      : 'text-green-500'
                  )}
                >
                  <ArrowLeftRight
                    className={cn(
                      'h-6 w-6',
                      phase === 'switching' && 'animate-[wiggle_0.5s_ease-in-out_infinite]'
                    )}
                  />
                </div>
              </>
            )}

            {/* To Team */}
            <div
              className={cn(
                'flex flex-col items-center gap-2 transition-all duration-500',
                phase === 'switching' ? 'scale-100' : 'scale-110'
              )}
            >
              <div className="relative">
                <Avatar
                  className={cn(
                    'h-14 w-14 border-2 transition-all duration-500',
                    phase === 'switching'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-green-500 ring-4 ring-green-500/20'
                  )}
                >
                  <AvatarImage src={toTeam.avatarUrl || undefined} alt={toTeam.name} />
                  <AvatarFallback
                    className={cn(
                      'text-lg transition-colors duration-500',
                      phase === 'switching' ? 'bg-primary/10' : 'bg-green-500/10'
                    )}
                  >
                    {getTeamInitials(toTeam.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Success checkmark */}
                {phase === 'complete' && (
                  <div className="absolute -bottom-1 -right-1 animate-in zoom-in-50 duration-300">
                    <CheckCircle2 className="h-5 w-5 text-green-500 fill-background" />
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium max-w-[100px] truncate transition-colors duration-500',
                  phase === 'complete' && 'text-green-600'
                )}
              >
                {toTeam.name}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <Progress
              value={progress}
              className={cn(
                'h-2 transition-all duration-300',
                phase === 'complete' && '[&>div]:bg-green-500'
              )}
            />
            <DialogDescription className="text-center text-xs">
              {phase === 'switching'
                ? t('switcher.loadingTeamData')
                : t('switcher.ready')}
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
