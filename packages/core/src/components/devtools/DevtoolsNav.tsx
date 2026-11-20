"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from '../../lib/utils';
import type { PluginNavItem } from "../../types/plugin";
import { DEVTOOLS_NAV_ITEMS, isDevtoolsNavActive, pluginNavIcon } from './devtools-nav';

interface DevtoolsNavProps {
  pluginItems: PluginNavItem[];
  /** Icons only (the collapsed sidebar). */
  isCollapsed?: boolean;
  /** Called when a link is followed (the mobile menu closes itself). */
  onNavigate?: () => void;
}

/**
 * The links of the devtools area: its sections and, below them, the plugins' pages. Rendered by the
 * sidebar and by the mobile menu, so both show the same navigation.
 */
export function DevtoolsNav({ pluginItems, isCollapsed = false, onNavigate }: DevtoolsNavProps) {
  const pathname = usePathname();
  const t = useTranslations('devtools');

  const linkClass = (isActive: boolean) => cn(
    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    isActive ? "bg-violet-600 text-white dark:bg-violet-700" : "text-foreground",
    isCollapsed && "justify-center"
  );

  return (
    <div className="p-3 space-y-1">
      {DEVTOOLS_NAV_ITEMS.map((item) => {
        const IconComponent = item.icon;
        const title = t(item.titleKey);
        const description = t(item.descriptionKey);
        return (
          <Link
            key={item.titleKey}
            href={item.href}
            onClick={onNavigate}
            data-cy={`devtools-nav-${item.titleKey.split('.').pop()?.toLowerCase().replace(/\s+/g, '-')}`}
            className={linkClass(isDevtoolsNavActive(pathname, item.href))}
            title={isCollapsed ? title : description}
          >
            <IconComponent className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex-1">
                <div className="text-sm font-medium">{title}</div>
                <p className="text-xs opacity-80">{description}</p>
              </div>
            )}
          </Link>
        );
      })}

      {/* Plugin pages */}
      {pluginItems.length > 0 && (
        <div className="pt-3 space-y-1">
          {!isCollapsed && (
            <p
              className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              data-cy="devtools-plugins-section-label"
            >
              {t('nav.plugins')}
            </p>
          )}
          {isCollapsed && <div className="my-1 border-t border-border" />}
          {pluginItems.map((item) => {
            const IconComponent = pluginNavIcon(item.icon);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                data-cy={`devtools-plugin-nav-${item.href.split('/').pop()}`}
                className={linkClass(isDevtoolsNavActive(pathname, item.href))}
                title={isCollapsed ? item.label : item.description}
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.description && <p className="text-xs opacity-80">{item.description}</p>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
