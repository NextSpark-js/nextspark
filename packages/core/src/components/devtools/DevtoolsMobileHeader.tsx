"use client";

import { useTranslations } from "next-intl";

/**
 * DevtoolsMobileHeader Component
 *
 * Mobile header for the developer area shown only on mobile devices.
 * Uses translations for all text content.
 */
export function DevtoolsMobileHeader() {
  const t = useTranslations('devtools');

  return (
    <div className="lg:hidden bg-card border-b border-border p-4" data-cy="devtools-mobile-header">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <div className="h-5 w-5 bg-violet-600 dark:bg-violet-400 rounded-sm"></div>
        </div>
        <div>
          <h1 className="text-lg font-bold text-violet-600 dark:text-violet-400">{t('title')}</h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>
    </div>
  );
}
