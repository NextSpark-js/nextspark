/**
 * Scheduled Actions - Processor
 * Processes pending actions and manages their lifecycle
 */
import type { ProcessResult } from './types';
/**
 * Process pending actions
 * Fetches pending actions, executes them, and updates their status
 *
 * @param batchSize - Maximum number of actions to process (uses config default if not provided)
 * @returns Result with counts and errors
 *
 * @example
 * const result = await processPendingActions()
 * console.log(`Processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`)
 */
export declare function processPendingActions(batchSize?: number): Promise<ProcessResult>;
//# sourceMappingURL=processor.d.ts.map