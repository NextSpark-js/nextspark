"use client";

import { useState, useEffect, memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Copy, Check, Loader2, AlertCircle, Settings, Database, Code } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { codeToHtml } from "shiki";
import { useTranslations } from "next-intl";
import { sel } from '../../lib/test';

interface EntityInfo {
  slug: string;
  name: string;
  pluralName: string;
  icon: string;
  enabled: boolean;
  access: {
    public: boolean;
    api: boolean;
    metadata: boolean;
    shared: boolean;
  };
  fields: Array<{
    name: string;
    type: string;
    label?: string;
    required?: boolean;
  }>;
  // Note: Permissions are now defined centrally in permissions.config.ts
  // Use PermissionService to query entity permissions
}

interface JsonViewerProps {
  data: unknown;
  fontSize?: string;
}

/**
 * JsonViewer Component
 *
 * Renders JSON with syntax highlighting using Shiki.
 */
const JsonViewer = memo(function JsonViewer({ data, fontSize = "0.875rem" }: JsonViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const jsonString = JSON.stringify(data, null, 2);

  useEffect(() => {
    let mounted = true;

    codeToHtml(jsonString, {
      lang: "json",
      theme: "github-dark",
    })
      .then((result) => {
        if (mounted) {
          setHtml(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setHtml("");
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [jsonString]);

  if (isLoading) {
    return (
      <pre
        className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto"
        style={{ fontSize }}
      >
        <code>{jsonString}</code>
      </pre>
    );
  }

  if (!html) {
    return (
      <pre
        className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto"
        style={{ fontSize }}
      >
        <code>{jsonString}</code>
      </pre>
    );
  }

  return (
    <div
      className="[&_pre]:!m-0 [&_pre]:!rounded-lg [&_pre]:!p-4 overflow-x-auto"
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * ConfigViewer Component
 *
 * Displays configuration data with syntax highlighting and copy functionality.
 * Features:
 * - Theme configuration tab
 * - Entity registry tab
 * - JSON syntax highlighting (using Shiki - ~25KB vs 296KB)
 * - Copy to clipboard for each section
 */
export function ConfigViewer() {
  const t = useTranslations('devtools.config');
  const [themeConfig, setThemeConfig] = useState<Record<string, unknown> | null>(null);
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Load theme config
  useEffect(() => {
    async function loadThemeConfig() {
      try {
        setIsLoadingTheme(true);
        const response = await fetch('/api/devtools/config/theme');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load theme config');
        }

        setThemeConfig(data.data.config);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load theme config');
      } finally {
        setIsLoadingTheme(false);
      }
    }

    loadThemeConfig();
  }, []);

  // Load entities
  useEffect(() => {
    async function loadEntities() {
      try {
        setIsLoadingEntities(true);
        const response = await fetch('/api/devtools/config/entities');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load entities');
        }

        setEntities(data.data.entities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load entities');
      } finally {
        setIsLoadingEntities(false);
      }
    }

    loadEntities();
  }, []);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <p className="text-lg font-medium text-destructive">{t('error')}</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="theme" className="space-y-6" data-cy={sel('devtools.config.viewer')}>
      <TabsList>
        <TabsTrigger value="theme" data-cy={sel('devtools.config.tabTheme')}>
          <Settings className="h-4 w-4 mr-2" />
          {t('tabs.theme')}
        </TabsTrigger>
        <TabsTrigger value="entities" data-cy={sel('devtools.config.tabEntities')}>
          <Database className="h-4 w-4 mr-2" />
          {t('tabs.entities')}
        </TabsTrigger>
      </TabsList>

      {/* Theme Config Tab */}
      <TabsContent value="theme" data-cy={sel('devtools.config.themeContent')}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t('themeTitle')}
                </CardTitle>
                <CardDescription>{t('themeDescription')}</CardDescription>
              </div>
              {themeConfig && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(themeConfig, null, 2), 'theme')}
                  data-cy={sel('devtools.config.copyTheme')}
                >
                  {copiedSection === 'theme' ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copiedSection === 'theme' ? t('copied') : t('copy')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTheme ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden">
                <JsonViewer data={themeConfig} />
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Entities Tab */}
      <TabsContent value="entities" data-cy={sel('devtools.config.entitiesContent')}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t('entitiesTitle')}
                </CardTitle>
                <CardDescription>
                  {t('entitiesDescription', { count: entities.length })}
                </CardDescription>
              </div>
              {entities.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(entities, null, 2), 'entities')}
                  data-cy={sel('devtools.config.copyEntities')}
                >
                  {copiedSection === 'entities' ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copiedSection === 'entities' ? t('copied') : t('copy')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {entities.map((entity) => (
                  <AccordionItem key={entity.slug} value={entity.slug}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        <span className="font-medium">{entity.name}</span>
                        <span className="text-muted-foreground text-sm">({entity.slug})</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded ml-2">
                          {entity.fields?.length || 0} fields
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="rounded-lg overflow-hidden mt-2">
                        <JsonViewer data={entity} fontSize="0.75rem" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
