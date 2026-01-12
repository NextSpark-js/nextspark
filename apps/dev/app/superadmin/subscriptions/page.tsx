"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { sel } from "@nextsparkjs/core/selectors";
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
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-registry.client";
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
    label: "Active",
    icon: CheckCircle,
    variant: "default" as const,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  trialing: {
    label: "Trial",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  past_due: {
    label: "Past Due",
    icon: AlertCircle,
    variant: "destructive" as const,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  canceled: {
    label: "Canceled",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  expired: {
    label: "Expired",
    icon: XCircle,
    variant: "outline" as const,
    className: "bg-red-100 text-red-800 border-red-200",
  },
  paused: {
    label: "Paused",
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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions data");
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
              Back to Super Admin
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-muted-foreground">Loading subscription data...</p>
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
              Back to Super Admin
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Loading Subscriptions
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "Failed to load subscription data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
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
            Back to Super Admin
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage billing and subscription overview
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" data-cy={sel('superadmin.subscriptions.container')}>
        {/* MRR Card */}
        <Card className="border-green-200 bg-green-50/50" data-cy={sel('superadmin.subscriptions.mrr')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {stats?.mrrFormatted || "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              From {stats?.monthly || 0} monthly subscriptions
            </p>
          </CardContent>
        </Card>

        {/* ARR Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {stats?.arrFormatted || "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              From {stats?.yearly || 0} yearly subscriptions
            </p>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card data-cy={sel('superadmin.subscriptions.activeCount')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.trialing || 0} in trial
            </p>
          </CardContent>
        </Card>

        {/* Total Subscriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.free || 0} free, {stats?.paid || 0} paid
            </p>
          </CardContent>
        </Card>

        {/* Issues */}
        <Card className={stats?.pastDue && stats.pastDue > 0 ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats?.pastDue && stats.pastDue > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pastDue || 0}</div>
            <p className="text-xs text-muted-foreground">
              Past due payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      {data?.planDistribution && data.planDistribution.length > 0 && (
        <Card data-cy={sel('superadmin.subscriptions.planDistribution')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Plan Distribution
            </CardTitle>
            <CardDescription>
              Active subscriptions by plan
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
          placeholder="Search by team name or email..."
          className="w-full sm:max-w-xs"
          data-cy="subscriptions-search-input"
        />
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={handlePlanChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="plan-filter">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={intervalFilter} onValueChange={handleIntervalChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-cy="interval-filter">
            <SelectValue placeholder="Interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Intervals</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            data-cy="clear-filters-btn"
          >
            Clear Filters
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
            Subscriptions ({data?.pagination.total || 0})
          </CardTitle>
          <CardDescription>
            All team subscriptions and their billing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No subscriptions found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "No subscriptions have been created yet"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Actions</TableHead>
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
                            {statusInfo.label}
                          </Badge>
                          {sub.cancelAtPeriodEnd && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Cancels at period end
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const price = sub.billingInterval === 'yearly'
                              ? sub.plan.priceYearly
                              : sub.plan.priceMonthly;
                            const suffix = sub.billingInterval === 'yearly' ? '/yr' : '/mo';
                            return price && price > 0
                              ? `$${(price / 100).toFixed(2)}${suffix}`
                              : "Free";
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(sub.currentPeriodEnd), "MMM dd, yyyy")}
                          </div>
                          {sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date() && (
                            <div className="text-xs text-blue-600">
                              Trial ends {format(new Date(sub.trialEndsAt), "MMM dd")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/superadmin/teams/${sub.team.id}`}>
                                View Team
                              </Link>
                            </Button>
                            {sub.externalSubscriptionId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="text-muted-foreground"
                              >
                                <a
                                  href={`https://dashboard.stripe.com/test/subscriptions/${sub.externalSubscriptionId}`}
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
                Last updated:{" "}
                {new Date(data.metadata.requestedAt).toLocaleString()}
              </p>
              <p>Requested by: {data.metadata.requestedBy}</p>
              <p>Source: {data.metadata.source}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default getTemplateOrDefaultClient("app/superadmin/subscriptions/page.tsx", SubscriptionsPage);
