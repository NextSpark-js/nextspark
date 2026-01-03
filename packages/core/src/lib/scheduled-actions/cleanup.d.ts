/**
 * Scheduled Actions - Cleanup
 * Retention policy enforcement for old completed/failed actions
 */
/**
 * Clean up old completed and failed actions
 * Deletes actions older than the retention period
 *
 * @param retentionDays - Number of days to keep actions (uses config default if not provided)
 * @returns Number of actions deleted
 *
 * @example
 * // Clean up actions using config default
 * const deleted = await cleanupOldActions()
 * console.log(`Deleted ${deleted} old actions`)
 *
 * // Use custom retention period (overrides config)
 * const deleted = await cleanupOldActions(30)
 */
export declare function cleanupOldActions(retentionDays?: number): Promise<number>;
//# sourceMappingURL=cleanup.d.ts.map