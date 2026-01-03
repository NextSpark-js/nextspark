"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Copy, Check, Search, Tag, ExternalLink, ChevronDown, ChevronRight, FileCode2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { TAGS_REGISTRY, COVERAGE_SUMMARY } from '@nextsparkjs/registries/testing-registry';
import { sel } from '../../lib/test';
import { cn } from '../../lib/utils';

type TagCategory = keyof typeof TAGS_REGISTRY;

interface TagData {
  tag: string;
  testCount: number;
  files: string[];
}

const CATEGORY_DISPLAY_ORDER: TagCategory[] = [
  "layers",
  "priorities",
  "features",
  "flows",
  "blocks",
  "roles",
  "operations",
  "other",
];

const CATEGORY_COLORS: Record<TagCategory, string> = {
  layers: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300",
  priorities: "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300",
  features: "bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-900 dark:text-violet-300",
  flows: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
  blocks: "bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-300",
  roles: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900 dark:text-cyan-300",
  operations: "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300",
  other: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

/**
 * TagsOverview Component
 *
 * Displays all test tags organized by category.
 * Features:
 * - Tags grouped by category (layers, priorities, features, etc.)
 * - Search across all tags
 * - Copy grep command on click
 * - Link feature/block tags to their respective pages
 */
export function TagsOverview() {
  const t = useTranslations("devtools.tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<TagCategory>>(
    new Set(CATEGORY_DISPLAY_ORDER)
  );
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  // Count total tags
  const totalTags = useMemo(() => {
    let count = 0;
    for (const category of CATEGORY_DISPLAY_ORDER) {
      const categoryData = TAGS_REGISTRY[category];
      if (categoryData) {
        count += Object.keys(categoryData).length;
      }
    }
    return count;
  }, []);

  // Filter tags by search (searches tag names AND test file names)
  const filteredTagsByCategory = useMemo(() => {
    const result: Record<TagCategory, Record<string, TagData>> = {} as Record<
      TagCategory,
      Record<string, TagData>
    >;

    for (const category of CATEGORY_DISPLAY_ORDER) {
      const categoryData = TAGS_REGISTRY[category] as Record<string, TagData> | undefined;
      if (!categoryData) continue;

      const filteredTags: Record<string, TagData> = {};
      for (const [key, data] of Object.entries(categoryData)) {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          // Search in tag key and tag name
          const matchesTag = key.toLowerCase().includes(query) || data.tag.toLowerCase().includes(query);
          // Search in test file names
          const matchesFile = data.files.some((file) =>
            file.toLowerCase().includes(query)
          );
          if (!matchesTag && !matchesFile) {
            continue;
          }
        }
        filteredTags[key] = data;
      }

      if (Object.keys(filteredTags).length > 0) {
        result[category] = filteredTags;
      }
    }

    return result;
  }, [searchQuery]);

  const filteredTagCount = useMemo(() => {
    let count = 0;
    for (const category of Object.keys(filteredTagsByCategory) as TagCategory[]) {
      count += Object.keys(filteredTagsByCategory[category]).length;
    }
    return count;
  }, [filteredTagsByCategory]);

  const copyGrepCommand = (tag: string) => {
    const command = `npx cypress run --env grepTags="${tag}"`;
    navigator.clipboard.writeText(command);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const toggleCategory = (category: TagCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getLinkForTag = (category: TagCategory, key: string): string | null => {
    if (category === "features") {
      return `/devtools/features`;
    }
    if (category === "blocks") {
      return `/devtools/blocks/${key}`;
    }
    return null;
  };

  const toggleTagExpand = (tagKey: string) => {
    setExpandedTag((prev) => (prev === tagKey ? null : tagKey));
  };

  // Extract filename from path for display
  const getFileName = (path: string): string => {
    return path.split("/").pop() || path;
  };

  // Get shortened path (last 3 segments)
  const getShortPath = (path: string): string => {
    const segments = path.split("/");
    if (segments.length <= 4) return path;
    return ".../" + segments.slice(-4).join("/");
  };

  return (
    <div className="space-y-6" data-cy={sel("devtools.tags.viewer")}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {totalTags}
            </div>
            <p className="text-sm text-muted-foreground">{t("totalTags")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {COVERAGE_SUMMARY.tags.testFiles}
            </div>
            <p className="text-sm text-muted-foreground">{t("testFiles")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-cy={sel("devtools.tags.search")}
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t("showing", { count: filteredTagCount })}
      </p>

      {/* Tags by Category */}
      <div className="space-y-6">
        {CATEGORY_DISPLAY_ORDER.map((category) => {
          const tags = filteredTagsByCategory[category];
          if (!tags || Object.keys(tags).length === 0) return null;

          const isExpanded = expandedCategories.has(category);
          const tagCount = Object.keys(tags).length;

          return (
            <Card key={category} data-cy={sel("devtools.tags.category", { category })}>
              <CardHeader className="pb-2">
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    {t(`categories.${category}`)}
                    <Badge variant="secondary" className="ml-2">
                      {tagCount}
                    </Badge>
                  </CardTitle>
                  <span className="text-muted-foreground text-sm">
                    {isExpanded ? "−" : "+"}
                  </span>
                </button>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tags).map(([key, data]) => {
                      const link = getLinkForTag(category, key);
                      const isCopied = copiedTag === data.tag;
                      const isExpanded = expandedTag === `${category}-${key}`;
                      const tagKey = `${category}-${key}`;

                      return (
                        <div key={key} className="relative group">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                CATEGORY_COLORS[category],
                                "font-mono text-sm px-3 py-1 h-auto",
                                isExpanded && "ring-2 ring-offset-1 ring-violet-500"
                              )}
                              onClick={() => toggleTagExpand(tagKey)}
                              title={t("expandHint")}
                              data-cy={sel("devtools.tags.tag", { tag: key })}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 mr-1" />
                              ) : (
                                <ChevronRight className="h-3 w-3 mr-1" />
                              )}
                              {data.tag}
                              <span className="ml-2 text-xs opacity-70">({data.testCount})</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyGrepCommand(data.tag);
                              }}
                              title={t("copyHint")}
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          {link && (
                            <Link
                              href={link}
                              className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="View details"
                            >
                              <ExternalLink className="h-3 w-3 text-violet-600" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded test files panel */}
                  {Object.entries(tags).map(([key, data]) => {
                    const tagKey = `${category}-${key}`;
                    if (expandedTag !== tagKey) return null;

                    return (
                      <div
                        key={`panel-${key}`}
                        className="mt-3 p-4 bg-muted/50 rounded-lg border border-border animate-in fade-in slide-in-from-top-2 duration-200"
                        data-cy={sel("devtools.tags.files-panel", { tag: key })}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <FileCode2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {t("testFiles")} ({data.files.length})
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {data.files.map((file, idx) => {
                            const fileName = getFileName(file);
                            const shortPath = getShortPath(file);
                            const isHighlighted = searchQuery && file.toLowerCase().includes(searchQuery.toLowerCase());

                            return (
                              <li
                                key={idx}
                                className={cn(
                                  "text-xs font-mono px-2 py-1.5 rounded",
                                  isHighlighted
                                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200"
                                    : "bg-background hover:bg-muted"
                                )}
                                title={file}
                              >
                                <span className="text-muted-foreground">{shortPath.replace(fileName, "")}</span>
                                <span className="font-medium">{fileName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredTagCount === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("noResults")}</p>
            <p className="text-sm text-muted-foreground">{t("noResultsHint")}</p>
          </CardContent>
        </Card>
      )}

      {/* Copied toast */}
      {copiedTag && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t("copied")}
          </div>
        </div>
      )}
    </div>
  );
}
