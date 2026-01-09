"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  BarChart3,
  FileText,
  Tags,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sel } from "../../lib/test";

interface CoverageSummary {
  features: { total: number; withTests: number; withoutTests: number };
  flows: { total: number; withTests: number; withoutTests: number };
  totalTags: number;
  testFiles: number;
  byCategory: Record<string, number>;
}

interface FeatureItem {
  slug: string;
  title: string;
  category: string;
  testing: {
    hasTests: boolean;
    testCount: number;
    files: string[];
  };
}

interface FlowItem {
  slug: string;
  title: string;
  category: string;
  criticalPath: boolean;
  testing: {
    hasTests: boolean;
    testCount: number;
    files: string[];
  };
}

interface CoverageData {
  success: boolean;
  data: {
    tags: Record<string, Record<string, { tag: string; testCount: number; files: string[] }>>;
    summary: CoverageSummary;
    features: FeatureItem[];
    flows: FlowItem[];
    meta: { theme: string; generatedAt: string };
  };
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  percentage?: number;
  dataCy: string;
  subtext?: string;
}

function StatCard({ icon, label, value, percentage, dataCy, subtext }: StatCardProps) {
  return (
    <Card data-cy={dataCy}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground">{subtext}</p>
            )}
          </div>
        </div>
        {percentage !== undefined && (
          <div className="mt-3">
            <Progress value={percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-right">{percentage}%</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to get translated category name with fallback
const TAG_CATEGORY_MAP: Record<string, string> = {
  layers: "Layers",
  priorities: "Priorities",
  features: "Features",
  flows: "Flows",
  blocks: "Blocks",
  roles: "Roles",
  operations: "Operations",
  other: "Other",
};

export function TestCoverageDashboard() {
  const t = useTranslations("devtools.tests.dashboard");
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCoverage() {
      try {
        const response = await fetch("/api/v1/devtools/testing");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load coverage data");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchCoverage();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" data-cy={sel('devtools.tests.dashboard')}>
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center" data-cy={sel('devtools.tests.dashboard')}>
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-lg font-medium text-amber-600 dark:text-amber-400">{error}</p>
      </div>
    );
  }

  if (!data?.data) return null;

  const { summary, features = [], flows = [] } = data.data;
  const featureCoverage = summary.features.total > 0
    ? Math.round((summary.features.withTests / summary.features.total) * 100)
    : 0;
  const flowCoverage = summary.flows.total > 0
    ? Math.round((summary.flows.withTests / summary.flows.total) * 100)
    : 0;

  // Get uncovered features and flows
  const uncoveredFeatures = features.filter(f => !f.testing.hasTests);
  const uncoveredFlows = flows.filter(f => !f.testing.hasTests);
  const criticalUncoveredFlows = uncoveredFlows.filter(f => f.criticalPath);
  const hasGaps = uncoveredFeatures.length > 0 || uncoveredFlows.length > 0;

  return (
    <div className="space-y-6 h-full overflow-y-auto" data-cy={sel('devtools.tests.dashboard')}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-violet-600 dark:text-violet-400">
          {t("title")}
        </h2>
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        data-cy={sel('devtools.tests.dashboardStats')}
      >
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          label={t("features")}
          value={`${summary.features.withTests}/${summary.features.total}`}
          percentage={featureCoverage}
          dataCy={sel('devtools.tests.dashboardStatFeatures')}
          subtext={`${summary.features.withTests} ${t("withTests")}`}
        />
        <StatCard
          icon={<Workflow className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          label={t("flows")}
          value={`${summary.flows.withTests}/${summary.flows.total}`}
          percentage={flowCoverage}
          dataCy={sel('devtools.tests.dashboardStatFlows')}
          subtext={`${summary.flows.withTests} ${t("withTests")}`}
        />
        <StatCard
          icon={<FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          label={t("testFiles")}
          value={String(summary.testFiles)}
          dataCy={sel('devtools.tests.dashboardStatFiles')}
        />
        <StatCard
          icon={<Tags className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          label={t("tags")}
          value={String(summary.totalTags)}
          dataCy={sel('devtools.tests.dashboardStatTags')}
        />
      </div>

      {/* Coverage Gaps */}
      <Card data-cy={sel('devtools.tests.dashboardGaps')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {hasGaps ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {t("gaps")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasGaps ? (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p>{t("noGaps")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Critical Flows First */}
              {criticalUncoveredFlows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {t("criticalPath")} ({criticalUncoveredFlows.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {criticalUncoveredFlows.map((flow) => (
                      <Badge
                        key={flow.slug}
                        variant="destructive"
                        data-cy={sel('devtools.tests.dashboardGapItem', { slug: flow.slug })}
                      >
                        {flow.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncovered Features */}
              {uncoveredFeatures.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                    {t("features")} {t("withoutTests")} ({uncoveredFeatures.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {uncoveredFeatures.slice(0, 10).map((feature) => (
                      <Badge
                        key={feature.slug}
                        variant="outline"
                        className="border-amber-500 text-amber-600 dark:text-amber-400"
                        data-cy={sel('devtools.tests.dashboardGapItem', { slug: feature.slug })}
                      >
                        {feature.title}
                      </Badge>
                    ))}
                    {uncoveredFeatures.length > 10 && (
                      <Badge variant="secondary">
                        +{uncoveredFeatures.length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Non-critical Uncovered Flows */}
              {uncoveredFlows.filter(f => !f.criticalPath).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                    {t("flows")} {t("withoutTests")} ({uncoveredFlows.filter(f => !f.criticalPath).length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {uncoveredFlows.filter(f => !f.criticalPath).slice(0, 10).map((flow) => (
                      <Badge
                        key={flow.slug}
                        variant="outline"
                        className="border-amber-500 text-amber-600 dark:text-amber-400"
                        data-cy={sel('devtools.tests.dashboardGapItem', { slug: flow.slug })}
                      >
                        {flow.title}
                      </Badge>
                    ))}
                    {uncoveredFlows.filter(f => !f.criticalPath).length > 10 && (
                      <Badge variant="secondary">
                        +{uncoveredFlows.filter(f => !f.criticalPath).length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage by Category */}
      {summary.byCategory && Object.keys(summary.byCategory).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("coverage")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(summary.byCategory).map(([category, count]) => (
                <div
                  key={category}
                  className="text-center p-3 rounded-lg bg-muted/50"
                >
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {count}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {TAG_CATEGORY_MAP[category] || category}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
