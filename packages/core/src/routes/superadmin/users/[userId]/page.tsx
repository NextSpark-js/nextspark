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
  Users2,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Crown,
  Shield,
  Eye,
  Mail,
  CheckCircle2,
  XCircle,
  Database,
} from "lucide-react";
import Link from "next/link";
import { withBasePath } from "@nextsparkjs/core/lib/base-path"
import { formatLocaleDate, formatLocaleNumber } from "@nextsparkjs/core/lib/i18n/format"

interface TeamMembership {
  teamId: string;
  teamName: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
}

interface UserMeta {
  id: string;
  metaKey: string;
  metaValue: unknown;
  dataType: string | null;
  isPublic: boolean;
  isSearchable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserDetailData {
  user: UserDetail;
  teams: TeamMembership[];
  userMetas: UserMeta[];
  stats: {
    totalTeams: number;
    workTeams: number;
    personalTeams: number;
    ownedTeams: number;
  };
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
 * User Detail Page
 *
 * Displays detailed information about a specific user for superadmins.
 */
function UserDetailPage() {
  const t = useTranslations("superadmin");
  const tTeams = useTranslations("teams");
  const locale = useLocale();
  const teamRoleLabel = (role: string) => (tTeams.has(`roles.${role}`) ? tTeams(`roles.${role}`) : role);
  const params = useParams()!;
  const userId = params.userId as string;

  // Fetch user data from API
  const { data: userData, isLoading, error, refetch } = useQuery<UserDetailData>({
    queryKey: ["superadmin-user", userId],
    queryFn: async () => {
      const response = await fetch(withBasePath(`/api/superadmin/users/${userId}`));
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t("userDetail.notFound"));
        }
        throw new Error(t("userDetail.fetchFailed"));
      }
      return response.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Get user initials for avatar
  const getUserInitials = (firstName: string, lastName: string, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin/users" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("userDetail.backToUsers")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("userDetail.title")}</h1>
            <p className="text-muted-foreground">{t("usersPage.loading")}</p>
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
            <Link href="/superadmin/users" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("userDetail.backToUsers")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("userDetail.title")}</h1>
            <p className="text-muted-foreground">{t("shared.errorLoadingData")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("userDetail.errorTitle")}
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : t("errors.failedToLoadUserData")}
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

  const user = userData?.user;
  const teams = userData?.teams || [];
  const userMetas = userData?.userMetas || [];
  const stats = userData?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin/users" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("userDetail.backToUsers")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("userDetail.title")}</h1>
          <p className="text-muted-foreground">
            {t("userDetail.subtitle")}
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

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback
                className={
                  user?.role === "superadmin"
                    ? "bg-red-100 text-red-700 text-xl"
                    : "bg-primary/10 text-primary text-xl"
                }
              >
                {user
                  ? getUserInitials(user.firstName, user.lastName, user.email)
                  : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{user?.fullName}</CardTitle>
                <Badge
                  variant={user?.role === "superadmin" ? "destructive" : "secondary"}
                >
                  {user?.role === "superadmin" ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      {t("userDetail.superadmin")}
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      {user?.role || t("userDetail.userRole")}
                    </>
                  )}
                </Badge>
                <Badge
                  variant={user?.emailVerified ? "default" : "outline"}
                  className={user?.emailVerified ? "bg-green-100 text-green-700" : ""}
                >
                  {user?.emailVerified ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t("users.table.verified")}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      {t("users.table.unverified")}
                    </>
                  )}
                </Badge>
              </div>
              <CardDescription className="mt-1">{t("shared.id", { id: user?.id ?? "" })}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Email */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t("userDetail.email")}
              </h4>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-mono text-sm">{user?.email}</span>
              </div>
            </div>

            {/* Registered */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t("userDetail.registered")}
              </h4>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span>
                  {user?.createdAt
                    ? formatLocaleDate(user.createdAt, locale, "long")
                    : t("shared.unknown")}
                </span>
              </div>
            </div>

            {/* Last Updated */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t("userDetail.lastUpdated")}
              </h4>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span>
                  {user?.updatedAt
                    ? formatLocaleDate(user.updatedAt, locale, "long")
                    : t("shared.unknown")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("userDetail.totalTeams")}</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocaleNumber(stats?.totalTeams || 0, locale)}</div>
            <p className="text-xs text-muted-foreground">{t("userDetail.allMemberships")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("userDetail.ownedTeams")}</CardTitle>
            <Crown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatLocaleNumber(stats?.ownedTeams || 0, locale)}
            </div>
            <p className="text-xs text-muted-foreground">{t("userDetail.asOwner")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Memberships Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            {t("userDetail.memberships", { count: teams.length })}
          </CardTitle>
          <CardDescription>
            {t("userDetail.membershipsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Users2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t("userDetail.noMemberships")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("userDetail.noMembershipsDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("userDetail.columns.team")}</TableHead>
                    <TableHead>{t("userDetail.columns.role")}</TableHead>
                    <TableHead>{t("userDetail.columns.joined")}</TableHead>
                    <TableHead className="w-[80px]">{t("userDetail.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => {
                    const RoleIcon = roleIcons[team.role] || User;
                    return (
                      <TableRow key={team.teamId}>
                        <TableCell>
                          <div className="font-medium">{team.teamName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleColors[team.role]} className="gap-1">
                            <RoleIcon className="h-3 w-3" />
                            {teamRoleLabel(team.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {team.joinedAt
                              ? formatLocaleDate(team.joinedAt, locale)
                              : t("shared.unknown")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/superadmin/teams/${team.teamId}`}>
                              {t("userDetail.view")}
                            </Link>
                          </Button>
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

      {/* User Metadata Card */}
      <Card data-cy="superadmin-user-metas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-cy="superadmin-user-metas-title">
            <Database className="h-5 w-5" />
            {t("userDetail.metadata", { count: userMetas.length })}
          </CardTitle>
          <CardDescription>
            {t("userDetail.metadataDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userMetas.length === 0 ? (
            <div className="text-center py-8" data-cy="superadmin-user-metas-empty">
              <Database className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t("userDetail.noMetadata")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("userDetail.noMetadataDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table data-cy="superadmin-user-metas-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("userDetail.metaColumns.key")}</TableHead>
                    <TableHead>{t("userDetail.metaColumns.value")}</TableHead>
                    <TableHead>{t("userDetail.metaColumns.type")}</TableHead>
                    <TableHead>{t("userDetail.metaColumns.public")}</TableHead>
                    <TableHead>{t("userDetail.metaColumns.searchable")}</TableHead>
                    <TableHead>{t("userDetail.metaColumns.updated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userMetas.map((meta) => (
                    <TableRow key={meta.id} data-cy={`superadmin-user-meta-row-${meta.metaKey}`}>
                      <TableCell>
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded" data-cy={`superadmin-user-meta-key-${meta.metaKey}`}>
                          {meta.metaKey}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20" data-cy={`superadmin-user-meta-value-${meta.metaKey}`}>
                          {typeof meta.metaValue === "object"
                            ? JSON.stringify(meta.metaValue, null, 2)
                            : String(meta.metaValue)}
                        </pre>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs" data-cy={`superadmin-user-meta-type-${meta.metaKey}`}>
                          {meta.dataType || "json"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {meta.isPublic ? (
                          <Badge variant="default" className="bg-green-100 text-green-700" data-cy={`superadmin-user-meta-public-${meta.metaKey}`}>
                            {t("shared.yes")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-cy={`superadmin-user-meta-public-${meta.metaKey}`}>{t("shared.no")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {meta.isSearchable ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-700" data-cy={`superadmin-user-meta-searchable-${meta.metaKey}`}>
                            {t("shared.yes")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-cy={`superadmin-user-meta-searchable-${meta.metaKey}`}>{t("shared.no")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {meta.updatedAt
                            ? formatLocaleDate(meta.updatedAt, locale)
                            : t("shared.unknown")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Footer */}
      {userData?.metadata && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                {t("shared.footer.lastUpdated", { date: formatLocaleDate(userData.metadata.requestedAt, locale, "dateTime") })}
              </p>
              <p>{t("shared.footer.requestedBy", { name: userData.metadata.requestedBy })}</p>
              <p>{t("shared.footer.source", { source: userData.metadata.source })}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UserDetailPage
