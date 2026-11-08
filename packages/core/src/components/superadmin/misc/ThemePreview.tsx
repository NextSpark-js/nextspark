"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

import { Copy, Palette, Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "../../../providers/theme-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Theme Preview Component
 * 
 * Displays current theme colors, typography, and design tokens.
 * Shows both light and dark mode variations with copy functionality.
 */
export function ThemePreview() {
  const t = useTranslations("superadmin.gallery.theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t("themeControls.title")}
          </CardTitle>
          <CardDescription>
            {t("themeControls.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              {t("light")}
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              {t("dark")}
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              {t("system")}
            </Button>
            <Badge variant="outline" className="ml-auto">
              {t("current", { theme: t(theme) })}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Colors */}
        <Card>
          <CardHeader>
            <CardTitle>{t("groups.primary.title")}</CardTitle>
            <CardDescription>{t("groups.primary.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name={t("colors.primary.name")}
              description={t("colors.primary.description")}
              cssVar="--primary"
              copyValue="var(--primary)"
            />
            <ColorSwatch
              name={t("colors.primaryForeground.name")}
              description={t("colors.primaryForeground.description")}
              cssVar="--primary-foreground"
              copyValue="var(--primary-foreground)"
            />
            <ColorSwatch
              name={t("colors.secondary.name")}
              description={t("colors.secondary.description")}
              cssVar="--secondary"
              copyValue="var(--secondary)"
            />
            <ColorSwatch
              name={t("colors.secondaryForeground.name")}
              description={t("colors.secondaryForeground.description")}
              cssVar="--secondary-foreground"
              copyValue="var(--secondary-foreground)"
            />
          </CardContent>
        </Card>

        {/* Background Colors */}
        <Card>
          <CardHeader>
            <CardTitle>{t("groups.background.title")}</CardTitle>
            <CardDescription>{t("groups.background.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name={t("colors.background.name")}
              description={t("colors.background.description")}
              cssVar="--background"
              copyValue="var(--background)"
            />
            <ColorSwatch
              name={t("colors.foreground.name")}
              description={t("colors.foreground.description")}
              cssVar="--foreground"
              copyValue="var(--foreground)"
            />
            <ColorSwatch
              name={t("colors.card.name")}
              description={t("colors.card.description")}
              cssVar="--card"
              copyValue="var(--card)"
            />
            <ColorSwatch
              name={t("colors.cardForeground.name")}
              description={t("colors.cardForeground.description")}
              cssVar="--card-foreground"
              copyValue="var(--card-foreground)"
            />
          </CardContent>
        </Card>

        {/* Interactive Colors */}
        <Card>
          <CardHeader>
            <CardTitle>{t("groups.interactive.title")}</CardTitle>
            <CardDescription>{t("groups.interactive.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name={t("colors.accent.name")}
              description={t("colors.accent.description")}
              cssVar="--accent"
              copyValue="var(--accent)"
            />
            <ColorSwatch
              name={t("colors.accentForeground.name")}
              description={t("colors.accentForeground.description")}
              cssVar="--accent-foreground"
              copyValue="var(--accent-foreground)"
            />
            <ColorSwatch
              name={t("colors.muted.name")}
              description={t("colors.muted.description")}
              cssVar="--muted"
              copyValue="var(--muted)"
            />
            <ColorSwatch
              name={t("colors.mutedForeground.name")}
              description={t("colors.mutedForeground.description")}
              cssVar="--muted-foreground"
              copyValue="var(--muted-foreground)"
            />
          </CardContent>
        </Card>

        {/* Status Colors */}
        <Card>
          <CardHeader>
            <CardTitle>{t("groups.status.title")}</CardTitle>
            <CardDescription>{t("groups.status.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorSwatch
              name={t("colors.destructive.name")}
              description={t("colors.destructive.description")}
              cssVar="--destructive"
              copyValue="var(--destructive)"
            />
            <ColorSwatch
              name={t("colors.destructiveForeground.name")}
              description={t("colors.destructiveForeground.description")}
              cssVar="--destructive-foreground"
              copyValue="var(--destructive-foreground)"
            />
            <ColorSwatch
              name={t("colors.border.name")}
              description={t("colors.border.description")}
              cssVar="--border"
              copyValue="var(--border)"
            />
            <ColorSwatch
              name={t("colors.input.name")}
              description={t("colors.input.description")}
              cssVar="--input"
              copyValue="var(--input)"
            />
          </CardContent>
        </Card>
      </div>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>{t("typography.title")}</CardTitle>
          <CardDescription>{t("typography.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold">{t("typography.heading1")}</h1>
              <code className="text-xs text-muted-foreground">text-4xl font-bold</code>
            </div>
            <div>
              <h2 className="text-3xl font-bold">{t("typography.heading2")}</h2>
              <code className="text-xs text-muted-foreground">text-3xl font-bold</code>
            </div>
            <div>
              <h3 className="text-2xl font-bold">{t("typography.heading3")}</h3>
              <code className="text-xs text-muted-foreground">text-2xl font-bold</code>
            </div>
            <div>
              <h4 className="text-xl font-semibold">{t("typography.heading4")}</h4>
              <code className="text-xs text-muted-foreground">text-xl font-semibold</code>
            </div>
            <div>
              <p className="text-base">{t("typography.body")}</p>
              <code className="text-xs text-muted-foreground">text-base</code>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("typography.small")}</p>
              <code className="text-xs text-muted-foreground">text-sm text-muted-foreground</code>
            </div>
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{t("typography.code")}</code>
              <code className="text-xs text-muted-foreground block mt-1">text-xs bg-muted px-2 py-1 rounded</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Border Radius */}
      <Card>
        <CardHeader>
          <CardTitle>{t("radius.title")}</CardTitle>
          <CardDescription>{t("radius.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-none mb-2"></div>
              <code className="text-xs">rounded-none</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-sm mb-2"></div>
              <code className="text-xs">rounded-sm</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded mb-2"></div>
              <code className="text-xs">rounded</code>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary mx-auto rounded-lg mb-2"></div>
              <code className="text-xs">rounded-lg</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ColorSwatchProps {
  name: string;
  description: string;
  cssVar: string;
  copyValue: string;
}

function ColorSwatch({ name, description, cssVar, copyValue }: ColorSwatchProps) {
  const t = useTranslations("superadmin.gallery.theme");
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div 
        className="w-10 h-10 rounded-md border"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="flex-1">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        <code className="text-xs text-muted-foreground">{cssVar}</code>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigator.clipboard.writeText(copyValue)}
        className="h-8 w-8 p-0"
        aria-label={t("copy", { name })}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
