import type { ComponentType, ReactNode } from 'react'
import { cn } from '../../lib/utils'

const TONES = {
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
} as const

interface AreaPageHeaderProps {
  icon: ComponentType<{ className?: string }>
  title: ReactNode
  subtitle?: ReactNode
  /** What sits at the right: refresh, export, the "updated" note. */
  actions?: ReactNode
  /** Devtools is violet, superadmin red, as their sidebars. */
  tone?: keyof typeof TONES
  className?: string
}

/**
 * The header of a first-level page of the devtools and superadmin areas (#533): the section's icon, the title, the
 * subtitle, and the actions at the right. One component so the two areas read alike; the sidebar is how you go back.
 */
export function AreaPageHeader({ icon: Icon, title, subtitle, actions, tone = 'violet', className }: AreaPageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-[12rem] flex-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  )
}
