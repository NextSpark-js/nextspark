import { Suspense } from "react";
import { Code } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getAllPluginNavItems } from "@nextsparkjs/core/lib/plugins/nav-items";
import { DEVTOOLS_NAV_ITEMS, DEVTOOLS_ROOT, pluginNavIcon } from "@nextsparkjs/core/components/devtools/devtools-nav";

/** The selectors the first three links already had. */
const HOME_LINK_CY: Record<string, string> = {
  "/devtools/style": "devtools-home-style-link",
  "/devtools/tests": "devtools-home-tests-link",
  "/devtools/config": "devtools-home-config-link",
};

/**
 * Developer Area Home Page
 *
 * Dashboard with quick links to development tools and documentation.
 * Shows overview of available sections in the dev area.
 */
async function DevHomePageContent() {
  const t = await getTranslations('devtools');
  const tCommon = await getTranslations('common');

  // Every section the sidebar lists (the same list, plugins included), but the dashboard itself
  const pluginItems = getAllPluginNavItems('devtools');
  const sections = [
    ...DEVTOOLS_NAV_ITEMS.filter((item) => item.href !== DEVTOOLS_ROOT).map((item) => ({
      title: t(item.titleKey),
      description: t(item.descriptionKey),
      icon: item.icon,
      href: item.href,
      cyId: HOME_LINK_CY[item.href] ?? `devtools-home-link-${item.href.split('/').pop()}`,
    })),
    ...pluginItems.map((item) => ({
      title: item.label,
      description: item.description ?? '',
      icon: pluginNavIcon(item.icon),
      href: item.href,
      cyId: `devtools-home-link-${item.href.split('/').pop()}`,
    })),
  ];

  return (
    <div className="space-y-6" data-cy="devtools-home-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Code className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-violet-600 dark:text-violet-400">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('home.welcome')}</CardTitle>
          <CardDescription>{t('home.welcomeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('home.intro')}
          </p>
        </CardContent>
      </Card>

      {/* Quick Links Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              data-cy={section.cyId}
            >
              <Card className="h-full hover:border-violet-600 dark:hover:border-violet-400 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-violet-100 dark:bg-violet-950 rounded-lg">
                      <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{section.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* System Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('home.systemInfo')}</CardTitle>
          <CardDescription>{t('home.systemInfoDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('home.accessLevel')}</p>
              <p className="text-lg font-semibold text-violet-600 dark:text-violet-400">{tCommon('userRoles.developer')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DevHomePage() {
  return (
    <Suspense fallback={null}>
      <DevHomePageContent />
    </Suspense>
  );
}
