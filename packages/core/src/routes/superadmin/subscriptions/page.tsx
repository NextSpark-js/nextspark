"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { sel } from "@nextsparkjs/core/lib/selectors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import { Badge } from "@nextsparkjs/core/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nextsparkjs/core/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextsparkjs/core/components/ui/select";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withBasePath, withBasePathIfInApp } from "@nextsparkjs/core/lib/base-path";
import { formatLocaleDate, formatLocaleDollars, formatLocaleNumber } from "@nextsparkjs/core/lib/i18n/format";
import {
  SearchInput,
  PaginationControls,
} from "@nextsparkjs/core/components/superadmin/filters";

interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  type: string;
  priceMonthly: number | null;
  priceYearly: number | null;
}

interface SubscriptionTeam {
  id: string;
  name: string;
  owner: {
    name: string;
    email: string;
  };
}

interface Subscription {
  id: string;
  team: SubscriptionTeam;
  plan: SubscriptionPlan;
  billingInterval: 'monthly' | 'yearly';
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  externalSubscriptionId: string | null;
  paymentProvider: string | null;
  providerDashboardUrl: string | null;
  createdAt: string;
}

interface PlanDistribution {
  slug: string;
  name: string;
  count: number;
}

interface SubscriptionsData {
  stats: {
    total: number;
    active: number;
    trialing: number;
    canceled: number;
    pastDue: number;
    free: number;
    paid: number;
    monthly: number;
    yearly: number;
    mrr: number;
    mrrFormatted: string;
    arr: number;
    arrFormatted: string;
  };
  planDistribution: PlanDistribution[];
  subscriptions: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  metadata: {
    requestedBy: string;
    requestedAt: string;
    source: string;
  };
}

const statusConfig = {
  active: {
    labelKey: "active",
    icon: CheckCircle,
    variant: "default" as const,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  trialing: {
    labelKey: "trialing",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  past_due: {
    labelKey: "past_due",
    icon: AlertCircle,
    variant: "destructive" as const,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  canceled: {
    labelKey: "canceled",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  expired: {
    labelKey: "expired",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-red-100 text-red-800 border-red-200",
  },
  paused: {
    labelKey: "paused",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

/**
 * Subscriptions Management Page
 *
 * Comprehensive subscription overview for superadmins.
 * Shows stats, MRR, plan distribution, and subscription list.
 */
function SubscriptionsPage() {
  const t = useTranslations("superadmin.subscriptions");
  const tErrors = useTranslations("superadmin.errors");
  const tShared = useTranslations("superadmin.shared");
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [intervalFilter, setIntervalFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Build query params
  const getQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (planFilter !== "all") params.set("plan", planFilter);
    if (intervalFilter !== "all") params.set("interval", intervalFilter);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  };

  // Handle filter changes
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handlePlanChange = (plan: string) => {
    setPlanFilter(plan);
    setPage(1);
  };

  const handleIntervalChange = (interval: string) => {
    setIntervalFilter(interval);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || planFilter !== "all" || intervalFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPlanFilter("all");
    setIntervalFilter("all");
    setPage(1);
  };

  // Fetch subscriptions data
  const { data, isLoading, isFetching, error, refetch } = useQuery<SubscriptionsData>({
    queryKey: ["superadmin-subscriptions", statusFilter, planFilter, intervalFilter, searchQuery, page, limit],
    queryFn: async () => {
      const queryString = getQueryParams();
      const url = `/api/superadmin/subscriptions${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(withBasePath(url));
      if (!response.ok) {
        throw new Error(t("fetchFailed"));
      }
      return response.json();
    },
    retry: 2,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {tShared("backToSuperAdmin")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("loading")}</p>
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
              {tShared("backToSuperAdmin")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{tShared("errorLoadingData")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("errorTitle")}
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : t("failedToLoad")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {tErrors("retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.stats;
  const subscriptions = data?.subscriptions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tShared("backToSuperAdmin")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {tShared("refresh")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" data-cy={sel('superadmin.subscriptions.container')}>
        {/* MRR Card */}
        <Card className="border-green-200 bg-green-50/50" data-cy={sel('superadmin.subscriptions.stats.mrr')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.mrr")}</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {stats?.mrrFormatted || formatLocaleDollars(0, locale)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("stats.fromMonthly", { count: stats?.monthly || 0 })}
            </p>
          </CardContent>
        </Card>

        {/* ARR Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.arr")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {stats?.arrFormatted || formatLocaleDollars(0, locale)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("stats.fromYearly", { count: stats?.yearly || 0 })}
            </p>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card data-cy={sel('superadmin.subscriptions.stats.activeCount')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.active")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocaleNumber(stats?.active || 0, locale)}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.inTrial", { count: stats?.trialing || 0 })}
            </p>
          </CardContent>
        </Card>

        {/* Total Subscriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.total")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocaleNumber(stats?.total || 0, locale)}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.freeAndPaid", { free: stats?.free || 0, paid: stats?.paid || 0 })}
            </p>
          </CardContent>
        </Card>

        {/* Issues */}
        <Card className={stats?.pastDue && stats.pastDue > 0 ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.needsAttention")}</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats?.pastDue && stats.pastDue > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocaleNumber(stats?.pastDue || 0, locale)}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.pastDue")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      {data?.planDistribution && data.planDistribution.length > 0 && (
        <Card data-cy={sel('superadmin.subscriptions.stats.planDistribution')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("planDistribution")}
            </CardTitle>
            <CardDescription>
              {t("planDistributionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {data.planDistribution.map((plan) => (
                <div
                  key={plan.slug}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-muted/30"
                >
                  <div className="font-medium">{plan.name}</div>
                  <Badge variant="secondary">{plan.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("searchPlaceholder")}
          className="w-full sm:max-w-xs"
          data-cy="subscriptions-search-input"
        />
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="status-filter">
            <SelectValue placeholder={t("filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("statuses.active")}</SelectItem>
            <SelectItem value="trialing">{t("filters.trialing")}</SelectItem>
            <SelectItem value="past_due">{t("statuses.past_due")}</SelectItem>
            <SelectItem value="canceled">{t("statuses.canceled")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={handlePlanChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="plan-filter">
            <SelectValue placeholder={t("filters.plan")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allPlans")}</SelectItem>
            <SelectItem value="free">{t("filters.free")}</SelectItem>
            <SelectItem value="pro">{t("filters.pro")}</SelectItem>
            <SelectItem value="enterprise">{t("filters.enterprise")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={intervalFilter} onValueChange={handleIntervalChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="interval-filter">
            <SelectValue placeholder={t("filters.interval")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allIntervals")}</SelectItem>
            <SelectItem value="monthly">{t("filters.monthly")}</SelectItem>
            <SelectItem value="yearly">{t("filters.yearly")}</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            data-cy="clear-filters-btn"
          >
            {t("clearFilters")}
          </Button>
        )}
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("listTitle", { count: data?.pagination.total || 0 })}
          </CardTitle>
          <CardDescription>
            {t("listDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t("empty.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? t("empty.adjustFilters")
                  : t("empty.none")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.team")}</TableHead>
                    <TableHead>{t("columns.plan")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.price")}</TableHead>
                    <TableHead>{t("columns.periodEnd")}</TableHead>
                    <TableHead>{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => {
                    const statusInfo = statusConfig[sub.status as keyof typeof statusConfig] || statusConfig.active;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sub.team.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {sub.team.owner.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.plan.type === "paid" ? "default" : "secondary"}>
                            {sub.plan.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(`statuses.${statusInfo.labelKey}`)}
                          </Badge>
                          {sub.cancelAtPeriodEnd && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("cancelsAtPeriodEnd")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const price = sub.billingInterval === 'yearly'
                              ? sub.plan.priceYearly
                              : sub.plan.priceMonthly;
                            return price && price > 0
                              ? t(sub.billingInterval === 'yearly' ? 'pricePerYear' : 'pricePerMonth', { price: formatLocaleDollars(price, locale) })
                              : t("filters.free");
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatLocaleDate(sub.currentPeriodEnd, locale)}
                          </div>
                          {sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date() && (
                            <div className="text-xs text-blue-600">
                              {t("trialEnds", { date: formatLocaleDate(sub.trialEndsAt, locale, "shortNoYear") })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/superadmin/teams/${sub.team.id}`}>
                                {t("viewTeam")}
                              </Link>
                            </Button>
                            {sub.providerDashboardUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="text-muted-foreground"
                                >
                                  <a
                                    href={withBasePathIfInApp(sub.providerDashboardUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="mt-4">
              <PaginationControls
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                limit={data.pagination.limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
                context="subscriptions"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Footer */}
      {data?.metadata && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                {tShared("footer.lastUpdated", { date: formatLocaleDate(data.metadata.requestedAt, locale, "dateTime") })}
              </p>
              <p>{tShared("footer.requestedBy", { name: data.metadata.requestedBy })}</p>
              <p>{tShared("footer.source", { source: data.metadata.source })}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SubscriptionsPage
