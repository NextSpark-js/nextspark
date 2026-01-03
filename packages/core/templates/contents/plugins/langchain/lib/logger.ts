import { FileLogger } from '@nextsparkjs/core/lib/utils/file-logger'

export interface AgentLoggerOptions {
    /** Agent name (e.g., 'graph-orchestrator', 'single-agent') */
    agentName: string
    /** User display name (firstname-lastname), defaults to 'system' */
    userName?: string
    /** Session timestamp, defaults to Date.now() */
    timestamp?: number
}

/**
 * Sanitize a string for use in filenames.
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters except hyphens and underscores
 * - Collapses multiple hyphens into one
 */
function sanitizeForFilename(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // spaces to hyphens
        .replace(/[^a-z0-9\-_]/g, '')   // remove special chars
        .replace(/-+/g, '-')            // collapse multiple hyphens
        .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
        || 'unknown'                     // fallback if empty
}

/**
 * Create a logger for an AI agent session.
 *
 * Logs are stored in: logger/langchain/{agentName}/{userName}-{timestamp}.log
 *
 * The caller is responsible for managing the logger lifecycle.
 * When the agent/session ends, the logger will be garbage collected.
 *
 * Logging is controlled by the LOG_ENABLED environment variable.
 *
 * @example
 * ```typescript
 * const logger = createAgentLogger({
 *     agentName: 'graph-orchestrator',
 *     userName: 'Carlos García',  // → carlos-garcia
 * })
 *
 * await logger.info('SESSION_INIT', { model: 'gpt-4' })
 * await logger.info('USER_MESSAGE', { message })
 * await logger.error('LLM_FAILED', { error })
 * ```
 */
export function createAgentLogger(options: AgentLoggerOptions): FileLogger {
    const { agentName, userName = 'system', timestamp = Date.now() } = options
    const sanitizedUserName = sanitizeForFilename(userName)

    return new FileLogger({
        folder: `langchain/${agentName}`,
        filename: `${sanitizedUserName}-${timestamp}`,
    })
}

/**
 * Clear all LangChain agent logs
 * @param agentName - Optional agent name to clear specific agent logs
 * @returns Number of log files deleted
 */
export async function clearAgentLogs(agentName?: string): Promise<number> {
    const folder = agentName ? `langchain/${agentName}` : 'langchain'
    return FileLogger.clearAll(folder)
}
