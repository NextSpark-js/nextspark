"use client";

import Link from "next/link";
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
import { APP_CONFIG_MERGED } from "@nextsparkjs/core/lib/config/config-sync";
import { PermissionService } from "@nextsparkjs/core/lib/services/permission.service";
import { PERMISSIONS_METADATA } from "@nextsparkjs/registries/permissions-registry";
import { getFullBillingMatrix } from "@nextsparkjs/core/lib/billing/queries";
import { RolesPermissionsMatrix } from "@nextsparkjs/core/components/superadmin/tables/RolesPermissionsMatrix";
import { PlanFeaturesMatrix } from "@nextsparkjs/core/components/superadmin/tables/PlanFeaturesMatrix";
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-registry.client";
import { sel } from "@nextsparkjs/core/selectors";

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
  const teamRolesConfig = APP_CONFIG_MERGED.teamRoles;
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
            Back to Super Admin
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Roles, Permissions & Plans
          </h1>
          <p className="text-muted-foreground">
            View team roles, permissions, and billing plan features
          </p>
        </div>
      </div>

      {/* Tabs for switching between matrices */}
      <Tabs defaultValue="rbac" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2" data-cy={sel('superadmin.teamRoles.tabs.container')}>
          <TabsTrigger value="rbac" className="flex items-center gap-2" data-cy={sel('superadmin.teamRoles.tabs.rbac')}>
            <Shield className="h-4 w-4" />
            RBAC Matrix
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2" data-cy={sel('superadmin.teamRoles.tabs.plans')}>
            <CreditCard className="h-4 w-4" />
            Plan Features
          </TabsTrigger>
        </TabsList>

        {/* RBAC Matrix Tab */}
        <TabsContent value="rbac" className="space-y-6">
          {/* RBAC Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Roles</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roles.length}</div>
                <p className="text-xs text-muted-foreground">Team role types</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{PERMISSIONS_METADATA.totalPermissions}</div>
                <p className="text-xs text-muted-foreground">
                  {PERMISSIONS_METADATA.corePermissions} core + {PERMISSIONS_METADATA.featurePermissions} features + {PERMISSIONS_METADATA.entityPermissions} entity
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Protected Role</CardTitle>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">owner</div>
                <p className="text-xs text-muted-foreground">Cannot be removed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Default Role</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamRolesConfig.defaultTeamRole}</div>
                <p className="text-xs text-muted-foreground">For invitations</p>
              </CardContent>
            </Card>
          </div>

          {/* Roles Hierarchy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Team Roles Hierarchy
              </CardTitle>
              <CardDescription>
                Roles ordered by hierarchy level. Higher values have more permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {sortedRoles.map((role) => (
                  <div
                    key={role}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card"
                    data-cy={sel('superadmin.teamRoles.rbac.hierarchy.roleCard', { role })}
                  >
                    <Badge variant={getRoleBadgeVariant(role)} className="font-semibold">
                      {hierarchy[role] ?? 0}
                    </Badge>
                    <div>
                      <div className="font-medium capitalize">{role}</div>
                      <div className="text-xs text-muted-foreground">
                        {permissionCounts[role]} permissions
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
              <CardTitle>Permissions Matrix</CardTitle>
              <CardDescription>
                Complete view of which permissions each team role has access to.
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
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">100</Badge>
                  <span className="text-muted-foreground">Owner (protected)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">50</Badge>
                  <span className="text-muted-foreground">Admin</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">10</Badge>
                  <span className="text-muted-foreground">Member</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">1</Badge>
                  <span className="text-muted-foreground">Viewer</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RBAC Source Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Source:</strong> Pre-computed permissions registry (build-time)
                </p>
                <p>
                  <strong>Roles config:</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    APP_CONFIG_MERGED.teamRoles
                  </code>
                </p>
                <p>
                  <strong>Permissions registry:</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    core/lib/registries/permissions-registry.ts
                  </code>
                </p>
                <p>
                  <strong>Generated at:</strong>{" "}
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
                <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalPlans}</div>
                <p className="text-xs text-muted-foreground">
                  {billingData.metadata.publicPlans} public
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Features</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalFeatures}</div>
                <p className="text-xs text-muted-foreground">Defined features</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Limits</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billingData.metadata.totalLimits}</div>
                <p className="text-xs text-muted-foreground">Quota types</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Theme</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{billingData.metadata.theme}</div>
                <p className="text-xs text-muted-foreground">Active theme</p>
              </CardContent>
            </Card>
          </div>

          {/* Plan Cards Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Available Plans
              </CardTitle>
              <CardDescription>
                Billing plans with their pricing and trial periods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {billingData.plans.map((plan) => (
                  <div
                    key={plan.slug}
                    className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card"
                    data-cy={sel('superadmin.teamRoles.plans.planCard', { slug: plan.slug })}
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
                      {plan.type}
                    </Badge>
                    <div>
                      <div className="font-medium capitalize">{plan.slug}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan.type === "free"
                          ? "Free forever"
                          : plan.type === "enterprise"
                          ? "Custom pricing"
                          : plan.price
                          ? `$${(plan.price.monthly / 100).toFixed(0)}/mo`
                          : "Contact sales"}
                        {plan.trialDays && plan.trialDays > 0 && (
                          <span className="ml-1 text-green-600">
                            ({plan.trialDays}d trial)
                          </span>
                        )}
                      </div>
                    </div>
                    {plan.visibility === "hidden" && (
                      <Badge variant="outline" className="text-[9px]">
                        hidden
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
              <CardTitle>Features & Limits Matrix</CardTitle>
              <CardDescription>
                Complete view of features and quotas included in each plan.
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
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">free</Badge>
                  <span className="text-muted-foreground">Free tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">paid</Badge>
                  <span className="text-muted-foreground">Subscription plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">enterprise</Badge>
                  <span className="text-muted-foreground">Custom/unlimited</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">monthly</Badge>
                  <span className="text-muted-foreground">Resets monthly</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Source Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Source:</strong> Pre-computed billing registry (module load)
                </p>
                <p>
                  <strong>Billing config:</strong>{" "}
                  <code className="bg-background px-1 rounded">
                    contents/themes/{billingData.metadata.theme}/billing/billing.config.ts
                  </code>
                </p>
                <p>
                  <strong>Billing registry:</strong>{" "}
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
            Three-Layer Permission Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p className="font-mono bg-background px-2 py-1 rounded inline-block mb-2">
              RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Layer 1 - Permission (RBAC):</strong> Does the user&apos;s role allow this action?
              </li>
              <li>
                <strong>Layer 2 - Feature (Plan):</strong> Does the subscription plan include this feature?
              </li>
              <li>
                <strong>Layer 3 - Quota (Limits):</strong> Is there available quota for this action?
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default getTemplateOrDefaultClient(
  "app/superadmin/team-roles/page.tsx",
  TeamRolesPage
);
