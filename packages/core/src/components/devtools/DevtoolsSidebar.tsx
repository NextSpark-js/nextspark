"use client";

import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code,
} from "lucide-react";
import { cn } from '../../lib/utils';
import { FEATURES } from '../../lib/config/build-features';
import { Button } from '../ui/button';
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getPluginNavItems } from "@nextsparkjs/registries/plugin-registry.client";
import type { PluginNavItem } from "../../types/plugin";
import { DevtoolsNav } from './DevtoolsNav';

/**
 * DevTools Sidebar Component
 *
 * Specialized sidebar for developer navigation within the /devtools area.
 * Reads plugin navigation items from @nextsparkjs/registries automatically.
 * Includes collapsible functionality and purple/violet branding.
 */
export function DevtoolsSidebar({ pluginItems: pluginItemsProp }: { pluginItems?: PluginNavItem[] } = {}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const t = useTranslations('devtools');
  const tCommon = useTranslations('common');
  const pluginItems = pluginItemsProp ?? getPluginNavItems('devtools');

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      data-cy="devtools-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-violet-100 dark:bg-violet-950 rounded-lg">
              <Code className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-violet-600 dark:text-violet-400">{t('title')}</h2>
              <p className="text-xs text-muted-foreground">{tCommon('userRoles.developer')}</p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          className="ml-auto"
          data-cy="devtools-sidebar-collapse-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto">
        <DevtoolsNav pluginItems={pluginItems} isCollapsed={isCollapsed} />
      </div>

      {/* Exit Section */}
      <div className="p-3 border-t border-border space-y-1">
        {/* Link to Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? t('exitToDashboard') : t('exitToDashboardDescription')}
          aria-label={t('exitToDashboard')}
          data-cy="devtools-sidebar-exit-to-dashboard"
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 text-sm font-medium">{t('exitToDashboard')}</div>
          )}
        </Link>

        {/* Link to Superadmin Panel (if user is also superadmin); with `features.superadmin: false` the area is not served (#425) */}
        {FEATURES.superadmin && <Link
          href="/superadmin"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? t('goToSuperadmin') : t('goToSuperadminDescription')}
          aria-label={t('goToSuperadmin')}
          data-cy="devtools-sidebar-go-to-superadmin"
        >
          <Shield className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 text-sm font-medium">{t('goToSuperadmin')}</div>
          )}
        </Link>}

        {/* Security Notice */}
        {!isCollapsed && (
          <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-lg">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <Code className="h-3 w-3" />
              <span className="text-xs font-medium">{t('restrictedArea')}</span>
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              {t('developerAccessOnly')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
