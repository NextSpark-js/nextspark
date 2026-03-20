"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
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
  Store,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// ===========================================
// TYPES
// ===========================================

interface ConnectedAccountSummary {
  id: string;
  teamId: string;
  teamName: string;
  provider: string;
  businessName: string | null;
  email: string;
  country: string;
  currency: string;
  onboardingStatus: string;
  chargesEnabled: boolean;
  commissionRate: number;
  createdAt: string;
}

interface MarketplaceStats {
  totalAccounts: number;
  activeAccounts: number;
  pendingAccounts: number;
  totalVolume: number;
  totalCommission: number;
  totalPayments: number;
  succeededPayments: number;
  disputedPayments: number;
}

interface SuperadminMarketplaceData {
  stats: MarketplaceStats;
  accounts: ConnectedAccountSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===========================================
// STATUS CONFIG
// ===========================================

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Active", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-200" },
  in_progress: { label: "In Progress", icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-200" },
  pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  restricted: { label: "Restricted", icon: AlertCircle, className: "bg-orange-100 text-orange-800 border-orange-200" },
  disabled: { label: "Disabled", icon: XCircle, className: "bg-red-100 text-red-800 border-red-200" },
  disconnected: { label: "Disconnected", icon: XCircle, className: "bg-gray-100 text-gray-800 border-gray-200" },
};

function formatCurrency(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// ===========================================
// PAGE
// ===========================================

export default function SuperadminMarketplacePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery<SuperadminMarketplaceData>({
    queryKey: ["superadmin-marketplace", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/superadmin/marketplace?${params}`);
      if (!res.ok) throw new Error("Failed to fetch marketplace data");
      return res.json();
    },
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error
            </CardTitle>
            <CardDescription>{error instanceof Error ? error.message : "Unknown error"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.stats;
  const accounts = data?.accounts ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground">Connected accounts and payment overview</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" data-cy="superadmin-marketplace-stats">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {stats ? formatCurrency(stats.totalVolume) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">{stats?.totalPayments ?? 0} total payments</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {stats ? formatCurrency(stats.totalCommission) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">From {stats?.succeededPayments ?? 0} succeeded payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAccounts ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.pendingAccounts ?? 0} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAccounts ?? 0}</div>
          </CardContent>
        </Card>

        <Card className={(stats?.disputedPayments ?? 0) > 0 ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disputed</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.disputedPayments ?? 0}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]" data-cy="superadmin-marketplace-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Connected Accounts ({pagination?.total ?? 0})
          </CardTitle>
          <CardDescription>All merchant accounts connected to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Store className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No connected accounts</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Merchants will appear here when they connect their payment accounts.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acct) => {
                    const sInfo = statusConfig[acct.onboardingStatus] || statusConfig.pending;
                    const SIcon = sInfo.icon;
                    return (
                      <TableRow key={acct.id} data-cy="superadmin-marketplace-account-row">
                        <TableCell>
                          <div className="font-medium">{acct.businessName || acct.teamName}</div>
                          <div className="text-sm text-muted-foreground">{acct.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {acct.provider === "stripe_connect" ? "Stripe" : "MercadoPago"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={sInfo.className}>
                            <SIcon className="h-3 w-3 mr-1" />
                            {sInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{(acct.commissionRate * 100).toFixed(0)}%</TableCell>
                        <TableCell>{acct.country.toUpperCase()}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(acct.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/superadmin/teams/${acct.teamId}`}>View Team</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
