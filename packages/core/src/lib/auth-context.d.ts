/**
 * Auth Context - AsyncLocalStorage for signup flow context
 *
 * This module provides a way to pass context from the signup route
 * to the Better Auth afterUserCreate hook, allowing us to skip
 * team creation when a user is being created via invitation.
 *
 * Why AsyncLocalStorage?
 * - Better Auth hooks don't receive custom parameters
 * - We need to communicate between the route handler and the hook
 * - AsyncLocalStorage provides request-scoped context in Node.js
 */
/// <reference types="node" />
import { AsyncLocalStorage } from 'async_hooks';
/**
 * Context passed during signup operations
 */
export interface SignupContext {
    /**
     * If true, skip automatic team creation in afterUserCreate hook.
     * Used when user is being created via invitation flow.
     */
    skipTeamCreation?: boolean;
    /**
     * The team ID the user is being invited to.
     * Used for tracking/logging purposes.
     */
    invitedTeamId?: string;
    /**
     * If true, this is the first user in single-tenant mode.
     * Should create the global work team.
     */
    isFirstUserSingleTenant?: boolean;
}
/**
 * AsyncLocalStorage instance for signup context
 *
 * Usage in route handler:
 * ```typescript
 * import { signupContextStorage } from './auth-context'
 *
 * await signupContextStorage.run({ skipTeamCreation: true }, async () => {
 *   // Create user via Better Auth
 *   await auth.signUp(...)
 * })
 * ```
 *
 * Usage in afterUserCreate hook:
 * ```typescript
 * import { signupContextStorage } from './auth-context'
 *
 * const context = signupContextStorage.getStore()
 * if (context?.skipTeamCreation) {
 *   return // Skip team creation
 * }
 * ```
 */
export declare const signupContextStorage: AsyncLocalStorage<SignupContext>;
/**
 * Helper to get current signup context
 * Returns undefined if not within a signupContextStorage.run() call
 */
export declare function getSignupContext(): SignupContext | undefined;
/**
 * Helper to check if team creation should be skipped
 */
export declare function shouldSkipTeamCreation(): boolean;
/**
 * Helper to run code within a signup context
 */
export declare function withSignupContext<T>(context: SignupContext, fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=auth-context.d.ts.map