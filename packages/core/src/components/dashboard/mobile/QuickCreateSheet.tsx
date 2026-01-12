'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../ui/sheet'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useQuickCreateEntities } from '../../../hooks/useQuickCreateEntities'
import { sel } from '../../../lib/test'
import { useTranslations } from 'next-intl'

interface QuickCreateSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCreateSheet({ isOpen, onOpenChange }: QuickCreateSheetProps) {
  const t = useTranslations()
  const { entities: availableEntities, isLoading, hasEntities } = useQuickCreateEntities()

  const handleLinkClick = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px]"
        data-cy={sel('dashboard.mobile.quickCreateSheet.container')}
      >
        <SheetHeader>
          <SheetTitle>{t('common.mobileNav.create')}</SheetTitle>
          <SheetDescription>
            {t('common.mobileNav.quickCreateDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No Entities State */}
          {!isLoading && !hasEntities && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('common.mobileNav.noEntitiesAvailable')}
            </div>
          )}

          {/* Entity Links */}
          {!isLoading && hasEntities && availableEntities.map((entity) => {
            const Icon = entity.icon
            return (
              <Link
                key={entity.slug}
                href={`/dashboard/${entity.slug}/create`}
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                data-cy={sel('dashboard.mobile.quickCreateSheet.item', { slug: entity.slug })}
              >
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{entity.names?.singular || entity.slug}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('common.mobileNav.createNew')} {(entity.names?.singular || entity.slug).toLowerCase()}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
