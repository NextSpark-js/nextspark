"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
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
import { Avatar, AvatarFallback } from "@nextsparkjs/core/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nextsparkjs/core/components/ui/table";
import {
  ArrowLeft,
  Users,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Crown,
  Shield,
  Eye,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Receipt,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-registry.client";

interface TeamOwner {
  id: string;
  name: string;
  email: string;
}

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
}

interface Team {
  id: string;
  name: string;
  owner: TeamOwner;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  type: string;
  priceMonthly: number | null;
  priceFormatted: string;
}

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;
  createdAt: string;
}

interface BillingEvent {
  id: string;
  type: string;
  status: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

interface UsageData {
  [key: string]: {
    current: number;
    periodKey: string;
  };
}

interface TeamDetailData {
  team: Team;
  members: TeamMember[];
  subscription: Subscription | null;
  billingHistory: BillingEvent[];
  usage: UsageData;
  metadata: {
    requestedBy: string;
    requestedAt: string;
    source: string;
  };
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors = {
  owner: "destructive",
  admin: "default",
  member: "secondary",
  viewer: "outline",
} as const;

/**
 * Team Detail Page
 *
 * Displays detailed information about a specific team for superadmins (read-only).
 */
function TeamDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  // Fetch team data from API
  const { data: teamData, isLoading, error, refetch } = useQuery<TeamDetailData>({
    queryKey: ["superadmin-team", teamId],
    queryFn: async () => {
      const response = await fetch(`/api/superadmin/teams/${teamId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Team not found");
        }
        throw new Error("Failed to fetch team data");
      }
      return response.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Get team initials for avatar
  const getTeamInitials = (name: string) => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin/teams" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Teams
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Details</h1>
            <p className="text-muted-foreground">Loading team data...</p>
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
            <Link href="/superadmin/teams" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Teams
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Details</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Loading Team
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "Failed to load team data"}
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

  const team = teamData?.team;
  const members = teamData?.members || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin/teams" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Team Details</h1>
          <p className="text-muted-foreground">
            View team information and members (read-only)
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

      {/* Team Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {team?.name ? getTeamInitials(team.name) : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{team?.name}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                ID: {team?.id}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Owner */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Owner
              </h4>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {team?.owner.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{team?.owner.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {team?.owner.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Members
              </h4>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-xl font-bold">{team?.memberCount || 0}</span>
                <span className="text-muted-foreground">
                  {team?.memberCount === 1 ? "member" : "members"}
                </span>
              </div>
            </div>

            {/* Created */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Created
              </h4>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span>
                  {team?.createdAt
                    ? format(new Date(team.createdAt), "MMMM dd, yyyy")
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({members.length})
          </CardTitle>
          <CardDescription>
            All members of this team and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No members</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This team has no members yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const RoleIcon = roleIcons[member.role] || User;
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {member.name?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="font-medium">{member.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{member.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleColors[member.role]} className="gap-1">
                            <RoleIcon className="h-3 w-3" />
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {member.joinedAt
                              ? format(new Date(member.joinedAt), "MMM dd, yyyy")
                              : "Unknown"}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Section */}
      {teamData?.subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Current subscription status and billing information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Plan */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Current Plan
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant={teamData.subscription.plan.type === 'paid' ? 'default' : 'secondary'}>
                    {teamData.subscription.plan.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {teamData.subscription.plan.priceFormatted}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Status
                </h4>
                <Badge
                  variant={
                    teamData.subscription.status === 'active' ? 'default' :
                    teamData.subscription.status === 'trialing' ? 'secondary' :
                    teamData.subscription.status === 'past_due' ? 'destructive' :
                    'outline'
                  }
                  className="gap-1"
                >
                  {teamData.subscription.status === 'active' && <CheckCircle className="h-3 w-3" />}
                  {teamData.subscription.status === 'trialing' && <Clock className="h-3 w-3" />}
                  {teamData.subscription.status === 'past_due' && <AlertCircle className="h-3 w-3" />}
                  {teamData.subscription.status === 'canceled' && <XCircle className="h-3 w-3" />}
                  {teamData.subscription.status.charAt(0).toUpperCase() + teamData.subscription.status.slice(1).replace('_', ' ')}
                </Badge>
                {teamData.subscription.cancelAtPeriodEnd && (
                  <p className="text-xs text-destructive mt-1">Cancels at period end</p>
                )}
              </div>

              {/* Current Period */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Current Period
                </h4>
                <div className="text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(teamData.subscription.currentPeriodStart), "MMM dd")} - {format(new Date(teamData.subscription.currentPeriodEnd), "MMM dd, yyyy")}
                  </div>
                </div>
              </div>

              {/* Trial / External Links */}
              <div>
                {teamData.subscription.trialEndsAt && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Trial Ends
                    </h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(teamData.subscription.trialEndsAt), "MMM dd, yyyy")}
                    </div>
                  </>
                )}
                {teamData.subscription.externalSubscriptionId && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Stripe
                    </h4>
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${teamData.subscription.externalSubscriptionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View in Stripe
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Subscription Metadata */}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              <span>Subscription ID: {teamData.subscription.id}</span>
              {teamData.subscription.externalCustomerId && (
                <span className="ml-4">Customer ID: {teamData.subscription.externalCustomerId}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Subscription</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This team does not have an active subscription.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing History */}
      {teamData?.billingHistory && teamData.billingHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Billing History
            </CardTitle>
            <CardDescription>
              Recent payment events and invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamData.billingHistory.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(event.createdAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{event.type.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.status === 'succeeded' ? 'default' :
                            event.status === 'pending' ? 'secondary' :
                            event.status === 'failed' ? 'destructive' :
                            'outline'
                          }
                          className="gap-1"
                        >
                          {event.status === 'succeeded' && <CheckCircle className="h-3 w-3" />}
                          {event.status === 'pending' && <Clock className="h-3 w-3" />}
                          {event.status === 'failed' && <XCircle className="h-3 w-3" />}
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {event.amountFormatted}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {event.invoiceUrl && (
                            <a
                              href={event.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              Invoice
                            </a>
                          )}
                          {event.receiptUrl && (
                            <a
                              href={event.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              Receipt
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Summary */}
      {teamData?.usage && Object.keys(teamData.usage).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Current Usage
            </CardTitle>
            <CardDescription>
              Resource usage for the current billing period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(teamData.usage).map(([limitSlug, usage]) => (
                <div key={limitSlug} className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground capitalize">
                    {limitSlug.replace(/_/g, ' ')}
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {usage.current.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Period: {usage.periodKey}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata Footer */}
      {teamData?.metadata && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Last updated:{" "}
                {new Date(teamData.metadata.requestedAt).toLocaleString()}
              </p>
              <p>Requested by: {teamData.metadata.requestedBy}</p>
              <p>Source: {teamData.metadata.source}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default getTemplateOrDefaultClient(
  "app/superadmin/teams/[teamId]/page.tsx",
  TeamDetailPage
);
