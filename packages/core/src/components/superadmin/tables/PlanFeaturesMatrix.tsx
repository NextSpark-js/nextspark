"use client";

import { Fragment } from "react";
import { Check, X, Infinity } from "lucide-react";
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { cn } from '../../../lib/utils';
import { sel } from '../../../lib/test';
import type { PlanDefinition, FeatureDefinition, LimitDefinition } from '../../../lib/billing/config-types';

interface FeaturesMatrix {
  features: Record<string, Record<string, boolean>>;
  limits: Record<string, Record<string, number>>;
}

interface PlanFeaturesMatrixProps {
  plans: PlanDefinition[];
  features: Record<string, FeatureDefinition>;
  limits: Record<string, LimitDefinition>;
  matrix: FeaturesMatrix;
}

/**
 * Plan Features Matrix Component
 *
 * Displays a consolidated matrix showing features and limits for each billing plan.
 * Features are shown with checkmarks, limits show the actual values.
 * Plans are sorted by type (free, paid, enterprise).
 */
export function PlanFeaturesMatrix({
  plans,
  features,
  limits,
  matrix,
}: PlanFeaturesMatrixProps) {
  // Sort plans: free first, then paid (by price), then enterprise
  const sortedPlans = [...plans].sort((a, b) => {
    const typeOrder = { free: 0, paid: 1, enterprise: 2 };
    const typeCompare = (typeOrder[a.type] ?? 1) - (typeOrder[b.type] ?? 1);
    if (typeCompare !== 0) return typeCompare;
    // Within same type, sort by monthly price
    return (a.price?.monthly ?? 0) - (b.price?.monthly ?? 0);
  });

  // Get plan badge variant based on type
  const getPlanBadgeVariant = (plan: PlanDefinition) => {
    switch (plan.type) {
      case "free":
        return "secondary";
      case "paid":
        return "default";
      case "enterprise":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Format price for display
  const formatPrice = (plan: PlanDefinition): string => {
    if (plan.type === "free") return "Free";
    if (plan.type === "enterprise") return "Contact Sales";
    if (!plan.price) return "N/A";
    return `$${(plan.price.monthly / 100).toFixed(0)}/mo`;
  };

  // Format limit value
  const formatLimit = (value: number, limitDef: LimitDefinition): string => {
    if (value === -1) return "Unlimited";
    if (value === 0) return "—";

    switch (limitDef.unit) {
      case "bytes":
        return `${value} GB`;
      case "calls":
        return value.toLocaleString();
      case "count":
      default:
        return value.toLocaleString();
    }
  };

  // Format feature slug for display
  const formatFeatureLabel = (slug: string, def: FeatureDefinition): string => {
    // Use i18n key as display (in real app, this would be translated)
    // For now, format the slug nicely
    return slug
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format limit slug for display
  const formatLimitLabel = (slug: string, def: LimitDefinition): string => {
    return slug
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const featureSlugs = Object.keys(features);
  const limitSlugs = Object.keys(limits);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Feature / Limit</TableHead>
            {sortedPlans.map((plan) => (
              <TableHead key={plan.slug} className="text-center min-w-[120px]">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="capitalize font-semibold">{plan.slug}</span>
                  <Badge
                    variant={getPlanBadgeVariant(plan)}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {formatPrice(plan)}
                  </Badge>
                  {plan.visibility === "hidden" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      hidden
                    </Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Features Section */}
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableCell
              colSpan={sortedPlans.length + 1}
              className="font-semibold text-sm py-3"
            >
              Features
            </TableCell>
          </TableRow>

          {featureSlugs.map((featureSlug) => (
            <TableRow
              key={featureSlug}
              data-cy={sel('superadmin.planFeatures.featureRow', { slug: featureSlug })}
              className="hover:bg-muted/30"
            >
              <TableCell className="font-medium text-sm text-muted-foreground pl-6">
                {formatFeatureLabel(featureSlug, features[featureSlug])}
              </TableCell>
              {sortedPlans.map((plan) => {
                const hasFeature = matrix.features[featureSlug]?.[plan.slug] ?? false;
                return (
                  <TableCell
                    key={`${plan.slug}-${featureSlug}`}
                    className="text-center"
                  >
                    {hasFeature ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-red-400/60 mx-auto" />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

          {/* Limits Section */}
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableCell
              colSpan={sortedPlans.length + 1}
              className="font-semibold text-sm py-3"
            >
              Limits & Quotas
            </TableCell>
          </TableRow>

          {limitSlugs.map((limitSlug) => {
            const limitDef = limits[limitSlug];
            return (
              <TableRow
                key={limitSlug}
                data-cy={sel('superadmin.planFeatures.limitRow', { slug: limitSlug })}
                className="hover:bg-muted/30"
              >
                <TableCell className="font-medium text-sm text-muted-foreground pl-6">
                  <div className="flex items-center gap-2">
                    {formatLimitLabel(limitSlug, limitDef)}
                    {limitDef.resetPeriod !== "never" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {limitDef.resetPeriod}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {sortedPlans.map((plan) => {
                  const value = matrix.limits[limitSlug]?.[plan.slug] ?? 0;
                  const isUnlimited = value === -1;
                  return (
                    <TableCell
                      key={`${plan.slug}-${limitSlug}`}
                      className={cn(
                        "text-center font-mono text-sm",
                        isUnlimited && "text-green-600"
                      )}
                    >
                      {isUnlimited ? (
                        <div className="flex items-center justify-center gap-1">
                          <Infinity className="h-4 w-4" />
                        </div>
                      ) : (
                        formatLimit(value, limitDef)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
