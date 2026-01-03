"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Copy, Check, Search, TestTube2, CheckCircle2, XCircle, ArrowRight, LayoutGrid, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry';
import { TAGS_REGISTRY } from '@nextsparkjs/registries/testing-registry';
import { sel } from '../../lib/test';
import type { BlockConfig, BlockCategory } from '../../types/blocks';

type CategoryFilter = "all" | BlockCategory;
type CoverageFilter = "all" | "covered" | "uncovered";

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

interface BlockWithCoverage extends BlockConfig {
  testCount: number;
  hasTests: boolean;
}

/**
 * BlocksViewer Component
 *
 * Displays the block registry with test coverage information.
 * Features:
 * - Grid of block cards
 * - Filter by category
 * - Filter by scope (pages/posts)
 * - Filter by coverage status
 * - Search by name/description
 * - Link to detail page
 */
export function BlocksViewer() {
  const t = useTranslations("devtools.blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Merge blocks with coverage data
  const blocksWithCoverage: BlockWithCoverage[] = useMemo(() => {
    const blockTags = TAGS_REGISTRY.blocks as unknown as Record<string, { tag: string; testCount: number; files: readonly string[] }>;
    return Object.values(BLOCK_REGISTRY).map((block) => {
      const tagData = blockTags[block.slug];
      return {
        ...block,
        testCount: tagData?.testCount || 0,
        hasTests: (tagData?.testCount || 0) > 0,
      };
    });
  }, []);

  const filteredBlocks = useMemo(() => {
    return blocksWithCoverage.filter((block) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          block.name.toLowerCase().includes(query) ||
          block.description.toLowerCase().includes(query) ||
          block.slug.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && block.category !== categoryFilter) {
        return false;
      }

      // Coverage filter
      if (coverageFilter !== "all") {
        if (coverageFilter === "covered" && !block.hasTests) return false;
        if (coverageFilter === "uncovered" && block.hasTests) return false;
      }

      return true;
    });
  }, [blocksWithCoverage, searchQuery, categoryFilter, coverageFilter]);

  const categories = useMemo(() => {
    const cats = new Set(blocksWithCoverage.map((b) => b.category));
    return Array.from(cats).sort();
  }, [blocksWithCoverage]);

  const stats = useMemo(() => {
    const total = blocksWithCoverage.length;
    const withTests = blocksWithCoverage.filter((b) => b.hasTests).length;
    return { total, withTests, withoutTests: total - withTests };
  }, [blocksWithCoverage]);

  const copyGrepCommand = (slug: string) => {
    const command = `npx cypress run --env grepTags="@b-${slug}"`;
    navigator.clipboard.writeText(command);
    setCopiedTag(slug);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  return (
    <div className="space-y-6" data-cy={sel("devtools.blocks.viewer")}>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {stats.total}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.total")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.withTests}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.covered")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {stats.withoutTests}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.uncovered")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-cy={sel("devtools.blocks.search")}
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
            data-cy={sel("devtools.blocks.filterAll")}
          >
            {t("filters.all")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat as CategoryFilter)}
              data-cy={sel("devtools.blocks.filterCategory", { category: cat })}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Coverage Filter */}
        <div className="flex gap-2">
          <Button
            variant={coverageFilter === "all" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("all")}
            data-cy={sel("devtools.blocks.coverageAll")}
          >
            {t("filters.allCoverage")}
          </Button>
          <Button
            variant={coverageFilter === "covered" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("covered")}
            className="text-green-600"
            data-cy={sel("devtools.blocks.coverageCovered")}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {t("filters.covered")}
          </Button>
          <Button
            variant={coverageFilter === "uncovered" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("uncovered")}
            className="text-gray-600"
            data-cy={sel("devtools.blocks.coverageUncovered")}
          >
            <XCircle className="h-4 w-4 mr-1" />
            {t("filters.uncovered")}
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t("showing", { count: filteredBlocks.length, total: blocksWithCoverage.length })}
      </p>

      {/* Block Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredBlocks.map((block) => (
          <Card
            key={block.slug}
            className="hover:shadow-md transition-shadow flex flex-col"
            data-cy={sel("devtools.blocks.card", { slug: block.slug })}
          >
            {/* Thumbnail */}
            <div className="h-32 bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
              {block.thumbnail ? (
                <img
                  src={block.thumbnail}
                  alt={block.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <LayoutGrid className="h-8 w-8 mb-1" />
                  <span className="text-xs">No preview</span>
                </div>
              )}
            </div>

            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{block.name}</CardTitle>
                <Badge className={CATEGORY_COLORS[block.category] || "bg-gray-100 text-gray-800"}>
                  {block.category}
                </Badge>
              </div>
              <CardDescription className="text-xs line-clamp-2">
                {block.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 flex-1 flex flex-col">
              {/* Scope badges */}
              <div className="flex gap-1">
                {(block.scope || []).map((scope) => (
                  <Badge key={scope} variant="outline" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {Object.keys(block.fieldDefinitions || {}).length} {t("fields")}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    <span>{block.examples?.length || 0} {t("examples")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TestTube2 className="h-3 w-3" />
                    <span>{block.testCount} {t("tests")}</span>
                  </div>
                </div>
              </div>

              {/* Tag with Copy */}
              <div className="flex items-center justify-between bg-muted rounded-md px-2 py-1 mt-auto">
                <code className="text-xs font-mono">@b-{block.slug}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyGrepCommand(block.slug)}
                  data-cy={sel("devtools.blocks.copyTag", { slug: block.slug })}
                >
                  {copiedTag === block.slug ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* View Details Link */}
              <Link
                href={`/devtools/blocks/${block.slug}`}
                className="flex items-center justify-center gap-1 text-sm text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 mt-2"
                data-cy={sel("devtools.blocks.viewDetails", { slug: block.slug })}
              >
                {t("viewDetails")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredBlocks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("noResults")}</p>
            <p className="text-sm text-muted-foreground">{t("noResultsHint")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
