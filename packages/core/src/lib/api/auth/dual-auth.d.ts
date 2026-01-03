/**
 * Dual Authentication System
 *
 * Supports both API Key and Session authentication in a single endpoint.
 * Used by the unified /api/v1/ endpoints.
 */
import { NextRequest } from 'next/server';
/**
 * System Admin Team - Members can bypass team context validation
 * This team is created in core/migrations/090_sample_data.sql
 */
export declare const SYSTEM_ADMIN_TEAM_ID = "team-nextspark-001";
/**
 * Header required to confirm cross-team access intention
 */
export declare const ADMIN_BYPASS_HEADER = "x-admin-bypass";
export declare const ADMIN_BYPASS_VALUE = "confirm-cross-team-access";
export interface DualAuthUser {
    id: string;
    email: string;
    role: string;
    name?: string;
    defaultTeamId?: string;
}
export interface DualAuthResult {
    success: boolean;
    type: 'api-key' | 'session' | 'none';
    user: DualAuthUser | null;
    scopes?: string[];
    rateLimitResponse?: Response;
}
/**
 * Try to authenticate request using either API Key or Session
 */
export declare function authenticateRequest(request: NextRequest): Promise<DualAuthResult>;
/**
 * Check if user has required scope (for API Key auth)
 */
export declare function hasRequiredScope(authResult: DualAuthResult, requiredScope: string): boolean;
/**
 * Check if user can bypass team context validation
 *
 * Three-layer security model:
 * 1. User must have elevated role (superadmin/developer)
 * 2. Request must include confirmation header (x-admin-bypass)
 * 3. User must be member of System Admin Team (NextSpark Team)
 *
 * @returns true if all conditions are met
 */
export declare function canBypassTeamContext(authResult: DualAuthResult, request: NextRequest): Promise<boolean>;
/**
 * Create standardized auth error response
 */
export declare function createAuthError(message?: string, status?: number): Response;
//# sourceMappingURL=dual-auth.d.ts.map