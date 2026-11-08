"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nextsparkjs/core/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  Shield,
  Users2,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { TeamsTable } from "@nextsparkjs/core/components/superadmin/tables/TeamsTable";
import {
  SearchInput,
  PaginationControls,
} from "@nextsparkjs/core/components/superadmin/filters";
import { sel } from "@nextsparkjs/core/lib/selectors";
import { useAdminTeams } from "@nextsparkjs/core/hooks/teams";
import { formatLocaleDate, formatLocaleNumber } from "@nextsparkjs/core/lib/i18n/format";

/**
 * Teams Management Page
 *
 * Comprehensive team viewing interface for superadmins (read-only).
 * Displays all teams with filtering by type.
 */
function TeamsPage() {
  const t = useTranslations("superadmin");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<"user" | "system">("user");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Handle tab change - reset page
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "user" | "system");
    setPage(1);
  };

  // Handle search change - reset page
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle limit change - reset page
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Fetch teams data using the shared hook
  const {
    teams: filteredTeams,
    counts,
    pagination,
    metadata,
    isLoading,
    error,
    refetch,
  } = useAdminTeams({
    search: searchQuery || undefined,
    type: activeTab,
    page,
    limit,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("shared.backToSuperAdmin")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("teamsPage.title")}</h1>
            <p className="text-muted-foreground">{t("teamsPage.loading")}</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("shared.backToSuperAdmin")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("teamsPage.title")}</h1>
            <p className="text-muted-foreground">{t("shared.errorLoadingData")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("teamsPage.errorTitle")}
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : t("teamsPage.failedToLoad")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t("errors.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-cy={sel('superadmin.teams.container')}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("shared.backToSuperAdmin")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("teamsPage.title")}</h1>
          <p className="text-muted-foreground">
            {t("teamsPage.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("shared.refresh")}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("teamsPage.totalTeams")}</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocaleNumber(counts?.total || 0, locale)}</div>
            <p className="text-xs text-muted-foreground">{t("teamsPage.allTeams")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("teamsPage.searchPlaceholder")}
          className="w-full max-w-sm"
          data-cy={sel('superadmin.teams.filters.search')}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setPage(1);
            }}
            data-cy={sel('superadmin.teams.filters.clearButton')}
          >
            {t("teamsPage.clear")}
          </Button>
        )}
      </div>

      {/* Tabs Section */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("teamsPage.userTeamsTab", { count: counts?.user || 0 })}
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("teamsPage.systemTeamsTab", { count: counts?.system || 0 })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Users className="h-5 w-5" />
                {t("teamsPage.userTeams")}
              </CardTitle>
              <CardDescription>
                {t("teamsPage.userTeamsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TeamsTable teams={filteredTeams} isLoading={isLoading} />
              {pagination && (
                <PaginationControls
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={pagination.limit}
                  onPageChange={setPage}
                  onLimitChange={handleLimitChange}
                  context="teams"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card className="border-violet-500/30">
            <CardHeader className="bg-violet-500/10">
              <CardTitle className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <Shield className="h-5 w-5" />
                {t("teamsPage.systemTeam")}
              </CardTitle>
              <CardDescription>
                {t("teamsPage.systemTeamDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TeamsTable teams={filteredTeams} isLoading={isLoading} />
              {pagination && (
                <PaginationControls
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={pagination.limit}
                  onPageChange={setPage}
                  onLimitChange={handleLimitChange}
                  context="teams"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metadata Footer */}
      {metadata && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                {t("shared.footer.lastUpdated", { date: formatLocaleDate(metadata.requestedAt, locale, "dateTime") })}
              </p>
              <p>{t("shared.footer.requestedBy", { name: metadata.requestedBy })}</p>
              <p>{t("shared.footer.source", { source: metadata.source })}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TeamsPage
