"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nextsparkjs/core/components/ui/tabs";
import { Badge } from "@nextsparkjs/core/components/ui/badge";
import Link from "next/link";
import { Palette, Package, Layers, BookOpen, Download, FormInput } from "lucide-react";
import { ComponentGallery } from "@nextsparkjs/core/components/superadmin/misc/ComponentGallery";
import { ThemePreview } from "@nextsparkjs/core/components/superadmin/misc/ThemePreview";
import { FieldTypesGallery } from "@nextsparkjs/core/components/superadmin/misc/FieldTypesGallery";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@nextsparkjs/core/components/ui/dropdown-menu";
import { COLOR_TOKENS, buildTokensExport, readToken, type TokensFormat } from "@nextsparkjs/core/components/superadmin/misc/theme-tokens";
import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Style Gallery Page - Developer Area
 *
 * Comprehensive design system showcase for developers.
 * Displays components, themes, and design tokens for reference and testing.
 */
export default function DevStylePage() {
  const t = useTranslations("devtools.style");
  const [activeTab, setActiveTab] = useState("components");

  // Downloads the color tokens as they resolve now (the current light or dark mode).
  const exportTokens = (format: TokensFormat) => {
    const mode = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const body = buildTokensExport(COLOR_TOKENS, readToken, format);
    const url = URL.createObjectURL(new Blob([body], { type: format === "css" ? "text/css" : "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `theme-tokens-${mode}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-6" data-cy="devtools-style-page">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Palette className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2" data-cy="devtools-style-export-tokens">
              <Download className="h-4 w-4" />
              {t("exportTokens")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => exportTokens("css")} data-cy="devtools-style-export-css">
              {t("exportCss")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportTokens("json")} data-cy="devtools-style-export-json">
              {t("exportJson")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.components")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30+</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.componentsDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.colorTokens")}</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{COLOR_TOKENS.length}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.colorTokensDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.themes")}</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.themesDescription")}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="components" className="flex items-center gap-2" data-cy="devtools-style-tab-components">
            <Package className="h-4 w-4" />
            {t("tabs.components")}
          </TabsTrigger>
          <TabsTrigger value="field-types" className="flex items-center gap-2" data-cy="devtools-style-tab-field-types">
            <FormInput className="h-4 w-4" />
            {t("tabs.fieldTypes")}
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex items-center gap-2" data-cy="devtools-style-tab-theme">
            <Palette className="h-4 w-4" />
            {t("tabs.theme")}
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-2" data-cy="devtools-style-tab-guidelines">
            <BookOpen className="h-4 w-4" />
            {t("tabs.guidelines")}
          </TabsTrigger>
        </TabsList>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-4" data-cy="devtools-style-component-gallery">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("components.title")}
              </CardTitle>
              <CardDescription>
                {t("components.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComponentGallery />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Field Types Tab */}
        <TabsContent value="field-types" className="space-y-4" data-cy="devtools-style-field-types">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FormInput className="h-5 w-5" />
                {t("fieldTypes.title")}
              </CardTitle>
              <CardDescription>
                {t("fieldTypes.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldTypesGallery />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-4" data-cy="devtools-style-theme-preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                {t("theme.title")}
              </CardTitle>
              <CardDescription>
                {t("theme.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePreview />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guidelines Tab */}
        <TabsContent value="guidelines" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Design Principles */}
            <Card>
              <CardHeader>
                <CardTitle>{t("principles.title")}</CardTitle>
                <CardDescription>{t("principles.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    {t("principles.consistency")}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("principles.consistencyDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    {t("principles.accessibility")}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("principles.accessibilityDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    {t("principles.scalability")}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("principles.scalabilityDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    {t("principles.performance")}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("principles.performanceDescription")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Usage Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>{t("usage.title")}</CardTitle>
                <CardDescription>{t("usage.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium">{t("usage.color")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("usage.colorDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">{t("usage.typography")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("usage.typographyDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">{t("usage.spacing")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("usage.spacingDescription")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">{t("usage.composition")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("usage.compositionDescription")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Technical Specs */}
            <Card>
              <CardHeader>
                <CardTitle>{t("specs.title")}</CardTitle>
                <CardDescription>{t("specs.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">{t("specs.framework")}</span>
                  <Badge variant="secondary">Next.js 14</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">{t("specs.styling")}</span>
                  <Badge variant="secondary">Tailwind CSS</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">{t("specs.components")}</span>
                  <Badge variant="secondary">Radix UI</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">{t("specs.icons")}</span>
                  <Badge variant="secondary">Lucide React</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">{t("specs.themeSystem")}</span>
                  <Badge variant="secondary">CSS Variables</Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">{t("specs.buildTool")}</span>
                  <Badge variant="secondary">Turbo</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card>
              <CardHeader>
                <CardTitle>{t("resources.title")}</CardTitle>
                <CardDescription>{t("resources.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://ui.shadcn.com" target="_blank">
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t("resources.docs", { name: "shadcn/ui" })}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://tailwindcss.com" target="_blank">
                    <Layers className="mr-2 h-4 w-4" />
                    {t("resources.docs", { name: "Tailwind CSS" })}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://www.radix-ui.com" target="_blank">
                    <Package className="mr-2 h-4 w-4" />
                    {t("resources.docs", { name: "Radix UI" })}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="https://lucide.dev" target="_blank">
                    <Palette className="mr-2 h-4 w-4" />
                    {t("resources.docs", { name: "Lucide" })}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
