'use client'

import Link from 'next/link'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Plus, Loader2 } from 'lucide-react'
import { useQuickCreateEntities } from '../../../hooks/useQuickCreateEntities'
import { sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function QuickCreateDropdown() {
  const t = useTranslations('navigation')
  const { entities: availableEntities, isLoading, hasEntities } = useQuickCreateEntities()

  // Don't render if loading or no entities available
  if (isLoading || !hasEntities) {
    // Show loading state for better UX
    if (isLoading) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          disabled
          aria-label={t('quickCreate')}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      )
    }
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={t('quickCreate')}
          data-cy={sel('dashboard.topnav.quickCreate.trigger')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-56"
        data-cy={sel('dashboard.topnav.quickCreate.content')}
      >
        <DropdownMenuLabel>{t('quickCreate')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {availableEntities.map((entity) => {
          const entityName = capitalize(entity.names?.singular || entity.slug)
          return (
            <DropdownMenuItem key={entity.slug} asChild>
              <Link
                href={`/dashboard/${entity.slug}/create`}
                className="flex items-center gap-3 w-full cursor-pointer"
                data-cy={sel('dashboard.topnav.quickCreate.link', { slug: entity.slug })}
              >
                <entity.icon className="h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{entityName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('quickCreateNew', { entity: entityName })}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
