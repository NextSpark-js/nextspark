'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { PricingTable } from './PricingTable'
import { useTranslations } from 'next-intl'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectPlan?: (planSlug: string) => void
}

/**
 * UpgradeModal - Modal dialog with pricing table for plan upgrades
 *
 * @example
 * ```tsx
 * <UpgradeModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSelectPlan={(slug) => handleUpgrade(slug)}
 * />
 * ```
 */
export function UpgradeModal({ open, onOpenChange, onSelectPlan }: UpgradeModalProps) {
  const t = useTranslations('billing')

  const handleSelectPlan = (planSlug: string) => {
    onSelectPlan?.(planSlug)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-cy="upgrade-modal">
        <DialogHeader>
          <DialogTitle data-cy="upgrade-modal-title">
            {t('upgrade')}
          </DialogTitle>
          <DialogDescription data-cy="upgrade-modal-description">
            {t('upgradeDescription') || 'Choose the plan that best fits your needs'}
          </DialogDescription>
        </DialogHeader>

        <div data-cy="upgrade-modal-plans">
          <PricingTable onSelectPlan={handleSelectPlan} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
