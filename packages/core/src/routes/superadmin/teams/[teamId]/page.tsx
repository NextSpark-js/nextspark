"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { withBasePath, withBasePathIfInApp } from "@nextsparkjs/core/lib/base-path"
import { formatLocaleDate, formatLocaleNumber } from "@nextsparkjs/core/lib/i18n/format"

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
  paymentProvider: string | null;
  providerName: string | null;
  providerDashboardUrl: string | null;
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
  const t = useTranslations("superadmin");
  const tTeams = useTranslations("teams");
  const locale = useLocale();
  const teamRoleLabel = (role: string) => (tTeams.has(`roles.${role}`) ? tTeams(`roles.${role}`) : role);
  // a status the catalog does not know (a provider's own) is shown as it comes
  const subscriptionStatusLabel = (status: string) =>
    t.has(`teamDetail.subscriptionStatuses.${status}`) ? t(`teamDetail.subscriptionStatuses.${status}`) : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  const billingStatusLabel = (status: string) =>
    t.has(`teamDetail.billingStatuses.${status}`) ? t(`teamDetail.billingStatuses.${status}`) : status.charAt(0).toUpperCase() + status.slice(1);
  const params = useParams()!;
  const teamId = params.teamId as string;

  // Fetch team data from API
  const { data: teamData, isLoading, error, refetch } = useQuery<TeamDetailData>({
    queryKey: ["superadmin-team", teamId],
    queryFn: async () => {
      const response = await fetch(withBasePath(`/api/superadmin/teams/${teamId}`));
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t("teamDetail.notFound"));
        }
        throw new Error(t("teamDetail.fetchFailed"));
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
              {t("teamDetail.backToTeams")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("teamDetail.title")}</h1>
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
            <Link href="/superadmin/teams" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("teamDetail.backToTeams")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("teamDetail.title")}</h1>
            <p className="text-muted-foreground">{t("shared.errorLoadingData")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("teamDetail.errorTitle")}
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

  const team = teamData?.team;
  const members = teamData?.members || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin/teams" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("teamDetail.backToTeams")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("teamDetail.title")}</h1>
          <p className="text-muted-foreground">
            {t("teamDetail.subtitle")}
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
                {t("shared.id", { id: team?.id ?? "" })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Owner */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t("teamDetail.owner")}
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
                {t("teamDetail.members")}
              </h4>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-xl font-bold">{formatLocaleNumber(team?.memberCount || 0, locale)}</span>
                <span className="text-muted-foreground">
                  {t("teamsTable.memberWord", { count: team?.memberCount ?? 0 })}
                </span>
              </div>
            </div>

            {/* Created */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t("teamDetail.created")}
              </h4>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span>
                  {team?.createdAt
                    ? formatLocaleDate(team.createdAt, locale, "long")
                    : t("shared.unknown")}
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
            {t("teamDetail.membersTitle", { count: members.length })}
          </CardTitle>
          <CardDescription>
            {t("teamDetail.membersDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t("teamDetail.noMembers")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("teamDetail.noMembersDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("teamDetail.memberColumns.member")}</TableHead>
                    <TableHead>{t("teamDetail.memberColumns.email")}</TableHead>
                    <TableHead>{t("teamDetail.memberColumns.role")}</TableHead>
                    <TableHead>{t("teamDetail.memberColumns.joined")}</TableHead>
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
                            {teamRoleLabel(member.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {member.joinedAt
                              ? formatLocaleDate(member.joinedAt, locale)
                              : t("shared.unknown")}
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
              {t("teamDetail.subscription")}
            </CardTitle>
            <CardDescription>
              {t("teamDetail.subscriptionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Plan */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t("teamDetail.currentPlan")}
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
                  {t("teamDetail.status")}
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
                  {subscriptionStatusLabel(teamData.subscription.status)}
                </Badge>
                {teamData.subscription.cancelAtPeriodEnd && (
                  <p className="text-xs text-destructive mt-1">{t("teamDetail.cancelsAtPeriodEnd")}</p>
                )}
              </div>

              {/* Current Period */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t("teamDetail.currentPeriod")}
                </h4>
                <div className="text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatLocaleDate(teamData.subscription.currentPeriodStart, locale, "shortNoYear")} - {formatLocaleDate(teamData.subscription.currentPeriodEnd, locale)}
                  </div>
                </div>
              </div>

              {/* Trial / External Links */}
              <div>
                {teamData.subscription.trialEndsAt && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {t("teamDetail.trialEnds")}
                    </h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {formatLocaleDate(teamData.subscription.trialEndsAt, locale)}
                    </div>
                  </>
                )}
                {teamData.subscription.providerDashboardUrl && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        {teamData.subscription.providerName || t("teamDetail.paymentProvider")}
                      </h4>
                      <a
                        href={withBasePathIfInApp(teamData.subscription.providerDashboardUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {t("teamDetail.viewIn", { name: teamData.subscription.providerName || t("teamDetail.providerFallback") })}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                )}
              </div>
            </div>

            {/* Subscription Metadata */}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              <span>{t("teamDetail.subscriptionId", { id: teamData.subscription.id })}</span>
              {teamData.subscription.externalCustomerId && (
                <span className="ml-4">{t("teamDetail.customerId", { id: teamData.subscription.externalCustomerId })}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("teamDetail.subscription")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t("teamDetail.noSubscription")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("teamDetail.noSubscriptionDescription")}
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
              {t("teamDetail.billingHistory")}
            </CardTitle>
            <CardDescription>
              {t("teamDetail.billingHistoryDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("teamDetail.billingColumns.date")}</TableHead>
                    <TableHead>{t("teamDetail.billingColumns.type")}</TableHead>
                    <TableHead>{t("teamDetail.billingColumns.status")}</TableHead>
                    <TableHead className="text-right">{t("teamDetail.billingColumns.amount")}</TableHead>
                    <TableHead>{t("teamDetail.billingColumns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamData.billingHistory.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatLocaleDate(event.createdAt, locale)}
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
                          {billingStatusLabel(event.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {event.amountFormatted}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {event.invoiceUrl && (
                            <a
                              href={withBasePathIfInApp(event.invoiceUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              {t("teamDetail.invoice")}
                            </a>
                          )}
                          {event.receiptUrl && (
                            <a
                              href={withBasePathIfInApp(event.receiptUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              {t("teamDetail.receipt")}
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
              {t("teamDetail.usage")}
            </CardTitle>
            <CardDescription>
              {t("teamDetail.usageDescription")}
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
                    {formatLocaleNumber(usage.current, locale)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("teamDetail.usagePeriod", { period: usage.periodKey })}
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
                {t("shared.footer.lastUpdated", { date: formatLocaleDate(teamData.metadata.requestedAt, locale, "dateTime") })}
              </p>
              <p>{t("shared.footer.requestedBy", { name: teamData.metadata.requestedBy })}</p>
              <p>{t("shared.footer.source", { source: teamData.metadata.source })}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TeamDetailPage
