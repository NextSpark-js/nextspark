/**
 * Scheduled Actions - Type Definitions
 * Core types for the scheduled actions system
 */
export type ScheduledActionStatus = 'pending' | 'running' | 'completed' | 'failed';
/**
 * Scheduled action record from database
 * NOTE: Database uses camelCase (e.g., actionType, teamId, scheduledAt)
 */
export interface ScheduledAction {
    id: string;
    actionType: string;
    status: ScheduledActionStatus;
    payload: unknown;
    teamId: string | null;
    scheduledAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    errorMessage: string | null;
    attempts: number;
    recurringInterval: string | null;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Action handler function signature
 * @param payload - The action payload (deserialized from JSONB)
 * @param action - The full action record
 */
export interface ScheduledActionHandler {
    (payload: unknown, action: ScheduledAction): Promise<void>;
}
/**
 * Action definition for registry
 */
export interface ScheduledActionDefinition {
    name: string;
    handler: ScheduledActionHandler;
    description?: string;
    timeout?: number;
}
/**
 * Options for scheduling an action
 */
export interface ScheduleOptions {
    scheduledAt?: Date;
    teamId?: string;
    recurringInterval?: 'hourly' | 'daily' | 'weekly' | string;
}
/**
 * Result of processing actions
 */
export interface ProcessResult {
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{
        actionId: string;
        error: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map