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
import { createTestId, createCyId } from '../../../lib/test'
// import { useTranslations } from 'next-intl' // TODO: Use when translations are needed

export function QuickCreateDropdown() {
  // const t = useTranslations('common') // TODO: Use translations when needed
  
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
          aria-label="Loading quick create options"
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
          aria-label="Quick create"
          data-testid={createTestId('topnav', 'quick-create', 'trigger')}
          data-cy={createCyId('topnav', 'quick-create-button')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="start" 
        className="w-56"
        data-testid={createTestId('topnav', 'quick-create', 'content')}
        data-cy={createCyId('topnav', 'quick-create-dropdown')}
      >
        <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableEntities.map((entity) => (
          <DropdownMenuItem key={entity.slug} asChild>
            <Link
              href={`/dashboard/${entity.slug}/create`}
              className="flex items-center gap-3 w-full cursor-pointer"
              data-testid={createTestId('quick-create', entity.slug, 'item')}
              data-cy={createCyId('quick-create', `${entity.slug}-link`)}
            >
              <entity.icon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{entity.names?.singular || entity.slug}</span>
                <span className="text-xs text-muted-foreground">
                  Create new {(entity.names?.singular || entity.slug).toLowerCase()}
                </span>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
