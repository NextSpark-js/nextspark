import { Code, Palette, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { getTranslations } from "next-intl/server";

/**
 * Developer Area Home Page
 *
 * Dashboard with quick links to development tools and documentation.
 * Shows overview of available sections in the dev area.
 */
export default async function DevHomePage() {
  const t = await getTranslations('dev');
  const tCommon = await getTranslations('common');

  const sections = [
    {
      title: t('nav.styleGallery'),
      description: t('style.description'),
      icon: Palette,
      href: "/devtools/style",
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-100 dark:bg-pink-950",
      cyId: "devtools-home-style-link"
    },
    {
      title: t('nav.testCases'),
      description: t('tests.description'),
      icon: FileText,
      href: "/devtools/tests",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-950",
      cyId: "devtools-home-tests-link"
    },
    {
      title: t('nav.config'),
      description: t('config.description'),
      icon: Settings,
      href: "/devtools/config",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-950",
      cyId: "devtools-home-config-link"
    },
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
                    <div className={`flex items-center justify-center w-10 h-10 ${section.bgColor} rounded-lg`}>
                      <Icon className={`h-5 w-5 ${section.color}`} />
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
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('home.hierarchy')}</p>
              <p className="text-lg font-semibold">100</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
