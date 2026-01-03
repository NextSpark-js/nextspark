"use client";

import { useMemo, Suspense, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ArrowLeft, LayoutGrid, TestTube2, CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry';
import { TAGS_REGISTRY } from '@nextsparkjs/registries/testing-registry';
import { getBlockComponent } from '../../lib/blocks/loader';
import { sel } from '../../lib/test';
import type { FieldDefinition, BlockConfig } from '../../types/blocks';

interface BlockDetailViewerProps {
  slug: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  hero: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
  content: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  cta: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  features: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  pricing: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  testimonials: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  stats: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  faq: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
};

/**
 * Loading fallback for lazy-loaded block preview
 */
function BlockPreviewLoading() {
  return (
    <div className="flex items-center justify-center py-20 bg-muted rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Loading block preview...</span>
    </div>
  );
}

/**
 * Error boundary fallback for block preview
 */
function BlockPreviewError({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
      <XCircle className="h-8 w-8 text-red-500 mb-3" />
      <p className="text-red-600 dark:text-red-400 font-medium">Failed to load block preview</p>
      <p className="text-sm text-red-500 dark:text-red-400/70 mt-1">{error}</p>
    </div>
  );
}

/**
 * BlockDetailViewer Component
 *
 * Displays detailed information about a single block.
 * Features:
 * - Overview tab with general info
 * - Fields tab with complete field definitions
 * - Preview tab with thumbnail if available
 */
export function BlockDetailViewer({ slug }: BlockDetailViewerProps) {
  const t = useTranslations("devtools.blocks.detail");

  // State for selected example
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);

  const block = useMemo(() => BLOCK_REGISTRY[slug], [slug]);

  const testCoverage = useMemo(() => {
    const blockTags = TAGS_REGISTRY.blocks as unknown as Record<string, { tag: string; testCount: number; files: readonly string[] }>;
    const tagData = blockTags[slug];
    return {
      testCount: tagData?.testCount || 0,
      hasTests: (tagData?.testCount || 0) > 0,
      files: tagData?.files ? [...tagData.files] : [],
    };
  }, [slug]);

  const fieldsByTab = useMemo(() => {
    if (!block?.fieldDefinitions) return {};

    const grouped: Record<string, Record<string, FieldDefinition>> = {};

    for (const [fieldKey, field] of Object.entries(block.fieldDefinitions)) {
      const tab = field.tab || "content";
      if (!grouped[tab]) {
        grouped[tab] = {};
      }
      grouped[tab][fieldKey] = field;
    }

    return grouped;
  }, [block]);

  // Get examples from block registry
  const examples = useMemo(() => block?.examples || [], [block]);
  const currentExample = useMemo(() => examples[selectedExampleIndex], [examples, selectedExampleIndex]);

  // Get the block component for preview
  const BlockComponent = useMemo(() => {
    if (!block) return null;
    const component = getBlockComponent(slug);
    console.log('[BlockDetailViewer] Loading block:', slug, 'Component:', component);
    return component;
  }, [block, slug]);

  if (!block) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Block not found</p>
          <p className="text-sm text-muted-foreground mb-4">
            The block &quot;{slug}&quot; does not exist in the registry.
          </p>
          <Link href="/devtools/blocks">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-cy={sel("devtools.blocks.detail.page", { slug })}>
      {/* Back link */}
      <Link
        href="/devtools/blocks"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t("back")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-32 h-24 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {block.thumbnail ? (
            <img
              src={block.thumbnail}
              alt={block.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{block.name}</h1>
            <Badge className={CATEGORY_COLORS[block.category] || "bg-gray-100 text-gray-800"}>
              {block.category}
            </Badge>
          </div>
          <p className="text-muted-foreground">{block.description}</p>

          <div className="flex items-center gap-4 mt-3">
            {/* Scope */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("scope")}:</span>
              {(block.scope || []).map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>

            {/* Test coverage */}
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{testCoverage.testCount} tests</span>
              {testCoverage.hasTests ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview" data-cy={sel("devtools.blocks.detail.tabPreview")}>
            <Eye className="h-4 w-4 mr-1" />
            {t("preview")}
          </TabsTrigger>
          <TabsTrigger value="fields" data-cy={sel("devtools.blocks.detail.tabFields")}>
            {t("fieldsTab")} ({Object.keys(block.fieldDefinitions || {}).length})
          </TabsTrigger>
          <TabsTrigger value="overview" data-cy={sel("devtools.blocks.detail.tabOverview")}>
            {t("overview")}
          </TabsTrigger>
        </TabsList>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t("livePreview")}
              </CardTitle>
              <CardDescription>
                {t("previewDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Example Selector - Show only if multiple examples */}
              {examples.length > 1 && (
                <div className="flex gap-2 flex-wrap" data-cy={sel("devtools.blocks.detail.exampleSelector")}>
                  {examples.map((ex, i) => (
                    <Button
                      key={i}
                      variant={i === selectedExampleIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedExampleIndex(i)}
                      data-cy={sel("devtools.blocks.detail.exampleBtn", { index: i.toString() })}
                    >
                      {ex.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Example Name and Description */}
              {currentExample && (
                <div className="space-y-1">
                  <h3 className="font-medium text-sm" data-cy={sel("devtools.blocks.detail.exampleName")}>
                    {currentExample.name}
                  </h3>
                  {currentExample.description && (
                    <p className="text-sm text-muted-foreground" data-cy={sel("devtools.blocks.detail.exampleDescription")}>
                      {currentExample.description}
                    </p>
                  )}
                </div>
              )}

              {/* Block Preview Container - Force light mode for consistent rendering */}
              {currentExample ? (
                <div
                  className="light border rounded-lg overflow-hidden bg-white text-gray-900"
                  style={{ colorScheme: "light" }}
                  data-cy={sel("devtools.blocks.detail.preview", { slug })}
                >
                  {BlockComponent ? (
                    <Suspense key={`${slug}-${selectedExampleIndex}`} fallback={<BlockPreviewLoading />}>
                      <BlockComponent {...currentExample.props} />
                    </Suspense>
                  ) : (
                    <BlockPreviewError error="Block component not found in registry" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-muted rounded-lg border">
                  <Eye className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No examples defined for this block</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Run <code className="bg-background px-2 py-1 rounded">/block:update {slug}</code> to add examples
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Example Props JSON */}
          {currentExample && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("exampleProps")}</CardTitle>
                <CardDescription>
                  {t("examplePropsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {JSON.stringify(currentExample.props, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-6">
          {Object.entries(fieldsByTab).map(([tabName, fields]) => (
            <Card key={tabName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg capitalize">{tabName}</CardTitle>
                <CardDescription>
                  {Object.keys(fields).length} fields
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">{t("fieldName")}</TableHead>
                      <TableHead className="w-[100px]">{t("fieldType")}</TableHead>
                      <TableHead className="w-[80px]">{t("required")}</TableHead>
                      <TableHead>{t("default")}</TableHead>
                      <TableHead>{t("options")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(fields).map(([fieldKey, field]) => (
                      <TableRow key={fieldKey}>
                        <TableCell className="font-mono text-sm">
                          {fieldKey}
                          {field.label && (
                            <div className="text-xs text-muted-foreground font-sans">
                              {field.label}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {field.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {field.required ? (
                            <span className="text-green-600">{t("yes")}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("no")}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {field.default !== undefined ? (
                            <code className="bg-muted px-1 py-0.5 rounded">
                              {JSON.stringify(field.default)}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {field.options ? (
                            <div className="flex flex-wrap gap-1">
                              {field.options.slice(0, 5).map((opt, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {opt.label || String(opt.value)}
                                </Badge>
                              ))}
                              {field.options.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{field.options.length - 5}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Block Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Slug</label>
                  <p className="font-mono">{block.slug}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">{t("category")}</label>
                  <p>{block.category}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">{t("scope")}</label>
                  <p>{(block.scope || []).join(", ")}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Icon</label>
                  <p className="font-mono">{block.icon}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Source</label>
                  <p>{block.source} ({block.sourceId})</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("testCoverage")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{testCoverage.testCount}</span>
                  <span className="text-muted-foreground">tests</span>
                </div>

                {testCoverage.hasTests ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Block has test coverage</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-5 w-5" />
                    <span>No tests for this block</span>
                  </div>
                )}

                {testCoverage.files.length > 0 && (
                  <div className="mt-4">
                    <label className="text-sm text-muted-foreground mb-2 block">Test files:</label>
                    <ul className="text-sm space-y-1">
                      {testCoverage.files.map((file: string, i: number) => (
                        <li key={i} className="font-mono text-xs text-muted-foreground truncate">
                          {file.split("/").pop()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 bg-muted rounded-md p-3">
                  <label className="text-xs text-muted-foreground mb-1 block">Grep command:</label>
                  <code className="text-xs font-mono">
                    npx cypress run --env grepTags=&quot;@b-{block.slug}&quot;
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
