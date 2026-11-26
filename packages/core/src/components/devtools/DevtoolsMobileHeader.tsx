"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Code, Menu, X } from "lucide-react";
import { getPluginNavItems } from "@nextsparkjs/registries/plugin-registry.client";
import type { PluginNavItem } from "../../types/plugin";
import { useCommonText } from "../../lib/i18n/common-text";
import { Button } from "../ui/button";
import { DevtoolsNav } from "./DevtoolsNav";

/**
 * DevtoolsMobileHeader Component
 *
 * Mobile header for the developer area shown only on mobile devices: the sidebar's icon and title, and a button
 * that opens the same navigation the sidebar renders (`DevtoolsNav`) in a drawer (#505).
 *
 * The drawer is a native modal `<dialog>` (focus trap, Escape and backdrop come with it) and not the shared `Sheet`:
 * `Sheet` is dashboard-only code, and a devtools route using it moved the shared chunks the dashboard loads.
 */
export function DevtoolsMobileHeader({ pluginItems: pluginItemsProp }: { pluginItems?: PluginNavItem[] } = {}) {
  const t = useTranslations('devtools');
  const openMenu = useCommonText('a11y', 'openNavigationMenu', 'Open navigation menu');
  const closeText = useCommonText('buttons', 'close', 'Close');
  const pluginItems = pluginItemsProp ?? getPluginNavItems('devtools');
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);

  // a link of the menu navigates: the drawer closes with it
  useEffect(() => drawer.current?.close(), [pathname]);

  // the header is `lg:hidden`: a modal dialog left open when the window grows to `lg` (a rotated tablet) would measure
  // 0x0 and still make the page inert, so it closes there
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)'); // jsdom has no matchMedia
    if (!query) return;
    const close = () => { if (query.matches) drawer.current?.close() };
    query.addEventListener('change', close);
    return () => query.removeEventListener('change', close);
  }, []);

  return (
    <div className="lg:hidden bg-card border-b border-border p-4" data-cy="devtools-mobile-header">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Code className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={openMenu}
          aria-haspopup="dialog"
          onClick={() => drawer.current?.showModal()}
          data-cy="devtools-mobile-menu-button"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <dialog
          ref={drawer}
          aria-label={t('title')}
          // a click on the backdrop lands on the dialog itself
          onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}
          className="m-0 h-full max-h-full w-72 max-w-[85vw] border-r border-border bg-background p-0 text-foreground backdrop:bg-black/60 open:flex open:flex-col"
          data-cy="devtools-mobile-menu"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{t('title')}</span>
            <Button variant="ghost" size="icon" aria-label={closeText} onClick={() => drawer.current?.close()}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DevtoolsNav pluginItems={pluginItems} />
          </div>
          <div className="p-3 border-t border-border">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              data-cy="devtools-mobile-exit-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5 flex-shrink-0" />
              {t('exitToDashboard')}
            </Link>
          </div>
        </dialog>
      </div>
    </div>
  );
}
