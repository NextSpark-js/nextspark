"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { format } from "date-fns";
import { useTeam } from "@nextsparkjs/core/hooks/useTeam";
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
  Store,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  ExternalLink,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Wallet,
  ArrowRight,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

// ===========================================
// TYPES
// ===========================================

interface MarketplaceAccount {
  id: string;
  provider: string;
  email: string;
  businessName: string | null;
  country: string;
  currency: string;
  onboardingStatus: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  commissionRate: number;
  fixedFee: number;
  payoutSchedule: string;
  createdAt: string;
  dashboardUrl: string | null;
  balance: { available: number; pending: number } | null;
}

interface MarketplacePayment {
  id: string;
  referenceId: string;
  referenceType: string;
  totalAmount: number;
  applicationFee: number;
  businessAmount: number;
  currency: string;
  status: string;
  statusDetail: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ===========================================
// STATUS CONFIG
// ===========================================

const onboardingStatusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Active", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-200" },
  in_progress: { label: "In Progress", icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-200" },
  pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  restricted: { label: "Restricted", icon: AlertCircle, className: "bg-orange-100 text-orange-800 border-orange-200" },
  disabled: { label: "Disabled", icon: XCircle, className: "bg-red-100 text-red-800 border-red-200" },
  disconnected: { label: "Disconnected", icon: XCircle, className: "bg-gray-100 text-gray-800 border-gray-200" },
};

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  succeeded: { label: "Succeeded", className: "bg-green-100 text-green-800" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", className: "bg-gray-100 text-gray-800" },
  partially_refunded: { label: "Partial Refund", className: "bg-orange-100 text-orange-800" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-800" },
  canceled: { label: "Canceled", className: "bg-gray-100 text-gray-800" },
};

// ===========================================
// HELPERS
// ===========================================

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function getProviderLabel(provider: string): string {
  if (provider === "stripe_connect") return "Stripe Connect";
  if (provider === "mercadopago_split") return "MercadoPago";
  return provider;
}

// ===========================================
// MAIN PAGE
// ===========================================

export default function MarketplaceSettingsPage() {
  const { teamId } = useTeam();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch account data
  const {
    data: accountData,
    isLoading: accountLoading,
    refetch: refetchAccount,
  } = useQuery<{ success: boolean; data: { connected: boolean; account: MarketplaceAccount | null } }>({
    queryKey: ["marketplace-account", teamId],
    queryFn: async () => {
      const res = await fetch("/api/v1/marketplace/account", {
        headers: teamId ? { "x-team-id": teamId } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch account");
      return res.json();
    },
    enabled: !!teamId,
    staleTime: 30000,
  });

  // Fetch payments
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{
    success: boolean;
    data: MarketplacePayment[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["marketplace-payments", teamId, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/marketplace/payments?${params}`, {
        headers: teamId ? { "x-team-id": teamId } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!teamId && accountData?.data?.connected === true,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const account = accountData?.data?.account;
  const isConnected = accountData?.data?.connected ?? false;
  const payments = paymentsData?.data ?? [];
  const pagination = paymentsData?.pagination;

  // Handle connect
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/v1/marketplace/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(teamId ? { "x-team-id": teamId } : {}),
        },
        body: JSON.stringify({ country: "US", businessType: "individual" }),
      });
      const data = await res.json();
      if (data.success && data.data?.onboardingUrl) {
        window.location.href = data.data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [teamId]);

  // Loading
  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground">Loading marketplace data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Not connected — show onboarding CTA
  if (!isConnected || !account) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground">Accept payments from your customers</p>
        </div>

        <Card className="border-dashed" data-cy="marketplace-connect-cta">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Connect Your Payment Account</CardTitle>
            <CardDescription className="text-base max-w-lg mx-auto">
              Connect your Stripe or MercadoPago account to start accepting payments
              from customers. The platform will handle payment processing and
              automatically transfer your earnings minus the platform commission.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={isConnecting}
                data-cy="marketplace-connect-btn"
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Connect Payment Account
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You will be redirected to complete verification. Your data is securely handled by the payment provider.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected — show dashboard
  const statusInfo = onboardingStatusConfig[account.onboardingStatus] || onboardingStatusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground">Manage your payment account and view earnings</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchAccount()} data-cy="marketplace-refresh-btn">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Account Status + Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-cy="marketplace-stats">
        {/* Account Status */}
        <Card data-cy="marketplace-account-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            <StatusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={statusInfo.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {getProviderLabel(account.provider)} &middot; {account.country.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              Commission: {(account.commissionRate * 100).toFixed(0)}%
              {account.fixedFee > 0 && ` + ${formatCurrency(account.fixedFee, account.currency)}`}
            </p>
          </CardContent>
        </Card>

        {/* Available Balance */}
        <Card className="border-green-200 bg-green-50/50" data-cy="marketplace-balance-available">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {account.balance ? formatCurrency(account.balance.available, account.currency) : "--"}
            </div>
            <p className="text-xs text-muted-foreground">Ready to be paid out</p>
          </CardContent>
        </Card>

        {/* Pending Balance */}
        <Card data-cy="marketplace-balance-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {account.balance ? formatCurrency(account.balance.pending, account.currency) : "--"}
            </div>
            <p className="text-xs text-muted-foreground">Processing, not yet available</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {account.chargesEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {account.dashboardUrl && (
              <Button variant="outline" asChild data-cy="marketplace-dashboard-link">
                <a href={account.dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open {getProviderLabel(account.provider)} Dashboard
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onboarding Warning */}
      {!account.chargesEnabled && (
        <Card className="border-yellow-200 bg-yellow-50/50" data-cy="marketplace-onboarding-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Complete Your Setup
            </CardTitle>
            <CardDescription>
              Your account is not yet ready to accept payments. Complete the verification process to start receiving payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnect} disabled={isConnecting} data-cy="marketplace-resume-onboarding-btn">
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Continue Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      {account.chargesEnabled && (
        <Card data-cy="marketplace-payments-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Recent Payments {pagination ? `(${pagination.total})` : ""}
                </CardTitle>
                <CardDescription>Payments received through the platform</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]" data-cy="marketplace-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No payments yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Payments will appear here when customers complete bookings.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Your Earnings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const pStatus = paymentStatusConfig[payment.status] || paymentStatusConfig.pending;
                        return (
                          <TableRow key={payment.id} data-cy="marketplace-payment-row">
                            <TableCell>
                              <div className="font-medium">{payment.referenceId}</div>
                              <div className="text-xs text-muted-foreground">{payment.referenceType}</div>
                            </TableCell>
                            <TableCell>{formatCurrency(payment.totalAmount, payment.currency)}</TableCell>
                            <TableCell className="text-green-700 font-medium">
                              {formatCurrency(payment.businessAmount, payment.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge className={pStatus.className}>{pStatus.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {payment.paidAt
                                ? format(new Date(payment.paidAt), "MMM dd, yyyy")
                                : format(new Date(payment.createdAt), "MMM dd, yyyy")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
