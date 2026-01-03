"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Copy, Check, Search, TestTube2, CheckCircle2, XCircle, Zap, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { FLOW_REGISTRY, COVERAGE_SUMMARY, type FlowEntry } from '@nextsparkjs/registries/testing-registry';
import { sel } from '../../lib/test';

type CategoryFilter = "all" | FlowEntry["category"];
type CoverageFilter = "all" | "covered" | "uncovered";

const CATEGORY_COLORS: Record<FlowEntry["category"], string> = {
  acquisition: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  navigation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  content: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  settings: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

/**
 * FlowsViewer Component
 *
 * Displays the flow registry with test coverage information.
 * Features:
 * - Card layout for each flow
 * - Critical path indicator
 * - Filter by category
 * - Filter by coverage status
 * - Search by name/description
 * - Copy grep command for each flow
 */
export function FlowsViewer() {
  const t = useTranslations("devtools.flows");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const flows = useMemo(() => Object.values(FLOW_REGISTRY), []);

  const filteredFlows = useMemo(() => {
    return flows.filter((flow) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          flow.name.toLowerCase().includes(query) ||
          flow.description.toLowerCase().includes(query) ||
          flow.key.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && flow.category !== categoryFilter) {
        return false;
      }

      // Coverage filter
      if (coverageFilter !== "all") {
        const hasCoverage = flow.testing.hasTests;
        if (coverageFilter === "covered" && !hasCoverage) return false;
        if (coverageFilter === "uncovered" && hasCoverage) return false;
      }

      return true;
    });
  }, [flows, searchQuery, categoryFilter, coverageFilter]);

  const categories = useMemo(() => {
    const cats = new Set(flows.map((f) => f.category));
    return Array.from(cats).sort();
  }, [flows]);

  const criticalCount = useMemo(() => {
    return flows.filter((f) => f.criticalPath).length;
  }, [flows]);

  const copyGrepCommand = (tag: string) => {
    const command = `npx cypress run --env grepTags="@${tag}"`;
    navigator.clipboard.writeText(command);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  return (
    <div className="space-y-6" data-cy={sel("devtools.flows.viewer")}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {COVERAGE_SUMMARY.flows.total}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.total")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {COVERAGE_SUMMARY.flows.withTests}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.covered")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {COVERAGE_SUMMARY.flows.withoutTests}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.uncovered")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {criticalCount}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.critical")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Warning if flows have no tests */}
      {COVERAGE_SUMMARY.flows.withoutTests > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {COVERAGE_SUMMARY.flows.withoutTests} flow(s) have no test coverage. Consider adding tests for critical user journeys.
            </p>
          </CardContent>
        </Card>
      )}

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
            data-cy={sel("devtools.flows.search")}
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
            data-cy={sel("devtools.flows.filterAll")}
          >
            {t("filters.all")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat as CategoryFilter)}
              data-cy={sel("devtools.flows.filterCategory", { category: cat })}
            >
              {t(`categories.${cat}`)}
            </Button>
          ))}
        </div>

        {/* Coverage Filter */}
        <div className="flex gap-2">
          <Button
            variant={coverageFilter === "all" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("all")}
            data-cy={sel("devtools.flows.coverageAll")}
          >
            {t("filters.allCoverage")}
          </Button>
          <Button
            variant={coverageFilter === "covered" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("covered")}
            className="text-green-600"
            data-cy={sel("devtools.flows.coverageCovered")}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {t("filters.covered")}
          </Button>
          <Button
            variant={coverageFilter === "uncovered" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCoverageFilter("uncovered")}
            className="text-red-600"
            data-cy={sel("devtools.flows.coverageUncovered")}
          >
            <XCircle className="h-4 w-4 mr-1" />
            {t("filters.uncovered")}
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t("showing", { count: filteredFlows.length, total: flows.length })}
      </p>

      {/* Flow Cards */}
      <div className="space-y-4">
        {filteredFlows.map((flow) => (
          <Card
            key={flow.key}
            className="hover:shadow-md transition-shadow"
            data-cy={sel("devtools.flows.card", { slug: flow.key })}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  {flow.criticalPath && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                      <Zap className="h-3 w-3 mr-1" />
                      {t("criticalPath")}
                    </Badge>
                  )}
                </div>
                <Badge className={CATEGORY_COLORS[flow.category]}>
                  {t(`categories.${flow.category}`)}
                </Badge>
              </div>
              <CardDescription>{flow.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Test Coverage */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {flow.testing.testCount} {t("tests")}
                  </span>
                </div>
                {flow.testing.hasTests ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("covered")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    {t("uncovered")}
                  </Badge>
                )}
              </div>

              {/* Tag with Copy */}
              <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                <code className="text-sm font-mono">@{flow.tag}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyGrepCommand(flow.tag)}
                  data-cy={sel("devtools.flows.copyTag", { slug: flow.key })}
                >
                  {copiedTag === flow.tag ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredFlows.length === 0 && (
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
