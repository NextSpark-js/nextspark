/**
 * Billing Enforcement Module
 *
 * Handles downgrade policy enforcement and quota checks.
 * Policy: Soft limit - existing resources remain, new ones blocked until under limit.
 *
 * P3: Downgrade Enforcement
 */
import type { QuotaInfo } from './types';
export interface DowngradeCheck {
    canDowngrade: boolean;
    overLimits: Array<{
        limitSlug: string;
        limitName: string;
        current: number;
        newMax: number;
        excess: number;
    }>;
    warnings: string[];
}
/**
 * Check if team can downgrade to a target plan
 * Returns info about any resources that exceed new limits
 *
 * Policy: Soft limit - downgrade is always allowed, but over-limit resources are read-only
 */
export declare function checkDowngrade(teamId: string, targetPlanSlug: string): Promise<DowngradeCheck>;
/**
 * Enhanced quota check that considers enforcement policy
 * Used when user is over limit after downgrade
 */
export declare function checkQuotaWithEnforcement(teamId: string, limitSlug: string): Promise<QuotaInfo & {
    enforced: boolean;
    enforcementReason?: string;
}>;
//# sourceMappingURL=enforcement.d.ts.map