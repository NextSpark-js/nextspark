export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface FileLoggerOptions {
    /**
     * Subfolder within logger/
     * @example 'ai' → logger/ai/
     * @example 'payments/stripe' → logger/payments/stripe/
     */
    folder?: string;
    /**
     * Log filename (without extension)
     * @example 'session-abc123' → session-abc123.log
     */
    filename: string;
    /**
     * Override the LOG_ENABLED environment variable.
     * If not specified, reads from LOG_ENABLED env var (default: false)
     */
    enabled?: boolean;
}
/**
 * File-based logger utility for themes and plugins.
 *
 * Enabled/disabled via LOG_ENABLED environment variable.
 *
 * @example
 * ```typescript
 * const logger = new FileLogger({
 *     folder: 'ai',
 *     filename: `session-${sessionId}`,
 * })
 *
 * await logger.info('USER_MESSAGE', { message })
 * await logger.error('LLM_FAILED', { error })
 * ```
 */
export declare class FileLogger {
    private static readonly BASE_DIR;
    private readonly logDir;
    private readonly logFile;
    private readonly enabled;
    constructor(options: FileLoggerOptions);
    private ensureDir;
    private write;
    /** Log with debug level */
    debug(action: string, data?: unknown): Promise<void>;
    /** Log with info level */
    info(action: string, data?: unknown): Promise<void>;
    /** Log with warn level */
    warn(action: string, data?: unknown): Promise<void>;
    /** Log with error level */
    error(action: string, data?: unknown): Promise<void>;
    /** Alias for info() */
    log(action: string, data?: unknown): Promise<void>;
    /** Clear this logger's log file */
    clear(): Promise<void>;
    /** Get the full path to the log file */
    getLogPath(): string;
    /**
     * Clear all .log files in a folder
     * @param folder - Subfolder within logger/ (optional)
     * @returns Number of files deleted
     */
    static clearAll(folder?: string): Promise<number>;
}
//# sourceMappingURL=file-logger.d.ts.map