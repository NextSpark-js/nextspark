"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  FileText,
  Settings,
  Shield,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code,
  Layers,
  GitBranch,
  LayoutGrid,
  Tag
} from "lucide-react";
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { useState } from "react";
import { useTranslations } from "next-intl";

interface SidebarItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  descriptionKey?: string;
  disabled?: boolean;
}

/**
 * DevTools Sidebar Component
 *
 * Specialized sidebar for developer navigation within the /devtools area.
 * Includes collapsible functionality and purple/violet branding.
 * Based on AdminSidebar pattern but with distinct developer-focused styling.
 */
export function DevtoolsSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const t = useTranslations('devtools');
  const tCommon = useTranslations('common');

  const sidebarItems: SidebarItem[] = [
    {
      titleKey: "nav.home",
      href: "/devtools",
      icon: LayoutDashboard,
      descriptionKey: "nav.homeDescription"
    },
    {
      titleKey: "nav.styleGallery",
      href: "/devtools/style",
      icon: Palette,
      descriptionKey: "nav.styleGalleryDescription"
    },
    {
      titleKey: "nav.testCases",
      href: "/devtools/tests",
      icon: FileText,
      descriptionKey: "nav.testCasesDescription"
    },
    {
      titleKey: "nav.features",
      href: "/devtools/features",
      icon: Layers,
      descriptionKey: "nav.featuresDescription"
    },
    {
      titleKey: "nav.flows",
      href: "/devtools/flows",
      icon: GitBranch,
      descriptionKey: "nav.flowsDescription"
    },
    {
      titleKey: "nav.blocks",
      href: "/devtools/blocks",
      icon: LayoutGrid,
      descriptionKey: "nav.blocksDescription"
    },
    {
      titleKey: "nav.tags",
      href: "/devtools/tags",
      icon: Tag,
      descriptionKey: "nav.tagsDescription"
    },
    {
      titleKey: "nav.config",
      href: "/devtools/config",
      icon: Settings,
      descriptionKey: "nav.configDescription"
    },
    {
      titleKey: "nav.api",
      href: "/devtools/api",
      icon: Layers,
      descriptionKey: "nav.apiDescription"
    },
  ];

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
      <div className="flex-1 p-3 space-y-2">
        {sidebarItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const title = t(item.titleKey);
          const description = item.descriptionKey ? t(item.descriptionKey) : undefined;

          if (item.disabled) {
            return (
              <div
                key={item.titleKey}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground cursor-not-allowed opacity-60",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? `${title} (${tCommon('comingSoon')})` : description}
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{title}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {tCommon('soon')}
                      </span>
                    </div>
                    {description && (
                      <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.titleKey}
              href={item.href}
              data-cy={`devtools-nav-${item.titleKey.split('.').pop()?.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-violet-600 text-white dark:bg-violet-700"
                  : "text-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? title : description}
            >
              <IconComponent className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex-1">
                  <div className="text-sm font-medium">{title}</div>
                  {description && (
                    <p className="text-xs opacity-80">{description}</p>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Exit Section */}
      <div className="p-3 border-t border-border space-y-2">
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
            <div className="flex-1">
              <div className="text-sm font-medium">{t('exitToDashboard')}</div>
              <p className="text-xs text-muted-foreground">{t('returnToDashboard')}</p>
            </div>
          )}
        </Link>

        {/* Link to Superadmin Panel (if user is also superadmin) */}
        <Link
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
            <div className="flex-1">
              <div className="text-sm font-medium">{t('goToSuperadmin')}</div>
              <p className="text-xs text-muted-foreground">{t('superAdminArea')}</p>
            </div>
          )}
        </Link>

        {/* Security Notice */}
        {!isCollapsed && (
          <div className="mt-3 p-2 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-lg">
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
