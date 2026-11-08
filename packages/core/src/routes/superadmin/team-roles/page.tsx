"use client";

import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nextsparkjs/core/components/ui/tabs";
import {
  ArrowLeft,
  Shield,
  Users,
  Lock,
  Eye,
  Key,
  CreditCard,
  Layers,
  Zap,
} from "lucide-react";
import { APP_CONFIG_MERGED } from "@nextsparkjs/core/lib/config/config-client";
import { PermissionService } from "@nextsparkjs/core/lib/services/permission.service";
import { PERMISSIONS_METADATA } from "@nextsparkjs/registries/permissions-registry";
import { getFullBillingMatrix } from "@nextsparkjs/core/lib/billing/queries";
import { RolesPermissionsMatrix } from "@nextsparkjs/core/components/superadmin/tables/RolesPermissionsMatrix";
import { PlanFeaturesMatrix } from "@nextsparkjs/core/components/superadmin/tables/PlanFeaturesMatrix";
import { formatLocaleDollars } from "@nextsparkjs/core/lib/i18n/format";

/**
 * Team Roles & Permissions Page
 *
 * Displays two consolidated matrices:
 * 1. RBAC Matrix - Team roles and their permissions
 * 2. Plan Features Matrix - Billing plans and their features/limits
 *
 * Both use pre-computed data for O(1) runtime lookups.
 */
function TeamRolesPage() {
  const t = useTranslations("superadmin.teamRoles");
  const tTeams = useTranslations("teams");
  const tShared = useTranslations("superadmin.shared");
  const locale = useLocale();
  const teamRoleLabel = (role: string) => (tTeams.has(`roles.${role}`) ? tTeams(`roles.${role}`) : role);
  const planTypeLabel = (type: string) => (t.has(`planTypes.${type}`) ? t(`planTypes.${type}`) : type);
  const teamRolesConfig = APP_CONFIG_MERGED.teams.roles;
  const roles = teamRolesConfig.availableTeamRoles;
  const hierarchy = teamRolesConfig.hierarchy;

  // Get full RBAC matrix from pre-computed registry
  const { permissions, matrix } = PermissionService.getMatrix();

  // Get full billing matrix from pre-computed registry
  const billingData = getFullBillingMatrix();

  // Sort roles by hierarchy for display
  const sortedRoles = [...roles].sort(
    (a, b) => (hierarchy[b] ?? 0) - (hierarchy[a] ?? 0)
  );

  // Convert FULL_MATRIX format to rolePermissions format for the matrix component
  const rolePermissions: Record<string, string[]> = {};
  for (const role of roles) {
    rolePermissions[role] = permissions
      .filter(p => matrix[p.id as keyof typeof matrix]?.[role])
      .map(p => p.id);
  }

  // All permission IDs
  const allPermissions = permissions.map(p => p.id);

  // Count permissions per role
  const permissionCounts = sortedRoles.reduce(
    (acc, role) => {
      acc[role] = rolePermissions[role]?.length ?? 0;
      return acc;
    },
    {} as Record<string, number>
  );

  // Get role badge variant based on hierarchy
  const getRoleBadgeVariant = (role: string) => {
    const h = hierarchy[role] ?? 0;
    if (h >= 100) return "destructive";
    if (h >= 50) return "default";
    if (h >= 10) return "secondary";
    return "outline";
  };

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
          <h1 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Tabs for switching between matrices */}
      <Tabs defaultValue="rbac" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rbac" className="flex items-center gap-2" data-cy="tab-rbac">
            <Shield className="h-4 w-4" />
            {t("tabs.rbac")}
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2" data-cy="tab-plans">
            <CreditCard className="h-4 w-4" />
            {t("tabs.plans")}
          </TabsTrigger>
        </TabsList>

        {/* RBAC Matrix Tab */}
        <TabsContent value="rbac" className="space-y-6">
          {/* RBAC Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("rbac.availableRoles")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roles.length}</div>
                <p className="text-xs text-muted-foreground">{t("rbac.roleTypes")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("rbac.totalPermissions")}</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{PERMISSIONS_METADATA.totalPermissions}</div>
                <p className="text-xs text-muted-foreground">
                  {t("rbac.permissionBreakdown", {
                    core: PERMISSIONS_METADATA.corePermissions,
                    features: PERMISSIONS_METADATA.featurePermissions,
                    entity: PERMISSIONS_METADATA.entityPermissions,
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("rbac.protectedRole")}</CardTitle>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamRoleLabel("owner")}</div>
                <p className="text-xs text-muted-foreground">{t("rbac.cannotBeRemoved")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("rbac.defaultRole")}</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamRoleLabel(teamRolesConfig.defaultTeamRole)}</div>
                <p className="text-xs text-muted-foreground">{t("rbac.forInvitations")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Roles Hierarchy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("rbac.hierarchy")}
              </CardTitle>
              <CardDescription>
                {t("rbac.hierarchyDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {sortedRoles.map((role) => (
                  <div
                    key={role}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card"
                    data-cy={`role-card-${role}`}
                  >
                    <Badge variant={getRoleBadgeVariant(role)} className="font-semibold">
                      {hierarchy[role] ?? 0}
                    </Badge>
                    <div>
                      <div className="font-medium capitalize">{teamRoleLabel(role)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("rbac.permissionCount", { count: permissionCounts[role] })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Permissions Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>{t("rbac.matrix")}</CardTitle>
              <CardDescription>
                {t("rbac.matrixDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolesPermissionsMatrix
                roles={roles}
                hierarchy={hierarchy}
                permissions={rolePermissions}
                allPermissions={allPermissions}
                permissionsData={permissions}
              />
            </CardContent>
          </Card>

          {/* RBAC Legend */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("legend")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">100</Badge>
                  <span className="text-muted-foreground">{t("rbac.legendOwner")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">50</Badge>
                  <span className="text-muted-foreground">{teamRoleLabel("admin")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">10</Badge>
                  <span className="text-muted-foreground">{teamRoleLabel("member")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">1</Badge>
                  <span className="text-muted-foreground">{teamRoleLabel("viewer")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RBAC Source Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>{t("sourceLabel")}</strong> {t("rbac.source")}
                </p>
                <p>
                  <strong>{t("rbac.rolesConfig")}</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    APP_CONFIG_MERGED.teams.roles
                  </code>
                </p>
                <p>
                  <strong>{t("rbac.permissionsRegistry")}</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    core/lib/registries/permissions-registry.ts
                  </code>
                </p>
                <p>
                  <strong>{t("rbac.generatedAt")}</strong>{" "}
                  {PERMISSIONS_METADATA.generatedAt}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan Features Tab */}
        <TabsContent value="plans" className="space-y-6">
          {/* Billing Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("plans.totalPlans")}</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalPlans}</div>
                <p className="text-xs text-muted-foreground">
                  {t("plans.publicPlans", { count: billingData.metadata.publicPlans })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("plans.features")}</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalFeatures}</div>
                <p className="text-xs text-muted-foreground">{t("plans.definedFeatures")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("plans.limits")}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalLimits}</div>
                <p className="text-xs text-muted-foreground">{t("plans.quotaTypes")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("plans.theme")}</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{billingData.metadata.theme}</div>
                <p className="text-xs text-muted-foreground">{t("plans.projectTheme")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Plan Cards Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("plans.available")}
              </CardTitle>
              <CardDescription>
                {t("plans.availableDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {billingData.plans.map((plan) => (
                  <div
                    key={plan.slug}
                    className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card"
                    data-cy={`plan-card-${plan.slug}`}
                  >
                    <Badge
                      variant={
                        plan.type === "enterprise"
                          ? "destructive"
                          : plan.type === "paid"
                          ? "default"
                          : "secondary"
                      }
                      className="font-semibold capitalize"
                    >
                      {planTypeLabel(plan.type)}
                    </Badge>
                    <div>
                      <div className="font-medium capitalize">{plan.slug}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan.type === "free"
                          ? t("plans.freeForever")
                          : plan.type === "enterprise"
                          ? t("plans.customPricing")
                          : plan.price
                          ? t("plans.perMonth", { price: formatLocaleDollars(plan.price.monthly, locale, { whole: true }) })
                          : t("plans.contactSales")}
                        {plan.trialDays && plan.trialDays > 0 && (
                          <span className="ml-1 text-green-600">
                            {t("plans.trialDays", { days: plan.trialDays })}
                          </span>
                        )}
                      </div>
                    </div>
                    {plan.visibility === "hidden" && (
                      <Badge variant="outline" className="text-[9px]">
                        {t("plans.hidden")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Plan Features Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>{t("plans.matrix")}</CardTitle>
              <CardDescription>
                {t("plans.matrixDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanFeaturesMatrix
                plans={billingData.plans}
                features={billingData.features}
                limits={billingData.limits}
                matrix={billingData.matrix}
              />
            </CardContent>
          </Card>

          {/* Plan Legend */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("legend")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{planTypeLabel("free")}</Badge>
                  <span className="text-muted-foreground">{t("plans.legendFree")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{planTypeLabel("paid")}</Badge>
                  <span className="text-muted-foreground">{t("plans.legendPaid")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{planTypeLabel("enterprise")}</Badge>
                  <span className="text-muted-foreground">{t("plans.legendEnterprise")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t("plans.monthly")}</Badge>
                  <span className="text-muted-foreground">{t("plans.legendMonthly")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Source Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>{t("sourceLabel")}</strong> {t("plans.source")}
                </p>
                <p>
                  <strong>{t("plans.billingConfig")}</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    config/billing.config.ts
                  </code>
                </p>
                <p>
                  <strong>{t("plans.billingRegistry")}</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    core/lib/registries/billing-registry.ts
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Three-Layer Model Info */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            {t("model.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p className="font-mono bg-background px-2 py-1 rounded inline-block mb-2">
              {t("model.formula")}
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>{t("model.layer1Title")}</strong> {t("model.layer1")}
              </li>
              <li>
                <strong>{t("model.layer2Title")}</strong> {t("model.layer2")}
              </li>
              <li>
                <strong>{t("model.layer3Title")}</strong> {t("model.layer3")}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TeamRolesPage
