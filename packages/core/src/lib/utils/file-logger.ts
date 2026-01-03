import fs from 'fs'
import path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Check if logging is enabled via environment variable.
 * Reads LOG_ENABLED from environment (default: false)
 */
function isLoggingEnabled(): boolean {
    const value = process.env.LOG_ENABLED
    return value === 'true' || value === '1'
}

export interface FileLoggerOptions {
    /**
     * Subfolder within logger/
     * @example 'ai' → logger/ai/
     * @example 'payments/stripe' → logger/payments/stripe/
     */
    folder?: string

    /**
     * Log filename (without extension)
     * @example 'session-abc123' → session-abc123.log
     */
    filename: string

    /**
     * Override the LOG_ENABLED environment variable.
     * If not specified, reads from LOG_ENABLED env var (default: false)
     */
    enabled?: boolean
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
export class FileLogger {
    private static readonly BASE_DIR = 'logger'

    private readonly logDir: string
    private readonly logFile: string
    private readonly enabled: boolean

    constructor(options: FileLoggerOptions) {
        const { folder, filename, enabled } = options

        // Use explicit enabled if provided, otherwise check environment
        this.enabled = enabled ?? isLoggingEnabled()
        this.logDir = path.join(
            process.cwd(),
            FileLogger.BASE_DIR,
            folder || ''
        )
        this.logFile = path.join(this.logDir, `${filename}.log`)
    }

    private ensureDir(): void {
        if (!fs.existsSync(this.logDir)) {
            try {
                fs.mkdirSync(this.logDir, { recursive: true })
            } catch (error) {
                console.error('[FileLogger] Failed to create directory:', error)
            }
        }
    }

    private async write(level: LogLevel, action: string, data?: unknown): Promise<void> {
        if (!this.enabled) return

        this.ensureDir()

        const timestamp = new Date().toISOString()
        const levelStr = level.toUpperCase().padEnd(5)
        const entry = [
            `[${timestamp}] [${levelStr}] [${action}]`,
            data ? JSON.stringify(data, null, 2) : '',
            '-'.repeat(50),
            '',
        ].join('\n')

        try {
            await fs.promises.appendFile(this.logFile, entry)
        } catch (error) {
            console.error(`[FileLogger] Failed to write to ${this.logFile}:`, error)
        }
    }

    /** Log with debug level */
    async debug(action: string, data?: unknown): Promise<void> {
        return this.write('debug', action, data)
    }

    /** Log with info level */
    async info(action: string, data?: unknown): Promise<void> {
        return this.write('info', action, data)
    }

    /** Log with warn level */
    async warn(action: string, data?: unknown): Promise<void> {
        return this.write('warn', action, data)
    }

    /** Log with error level */
    async error(action: string, data?: unknown): Promise<void> {
        return this.write('error', action, data)
    }

    /** Alias for info() */
    async log(action: string, data?: unknown): Promise<void> {
        return this.info(action, data)
    }

    /** Clear this logger's log file */
    async clear(): Promise<void> {
        if (fs.existsSync(this.logFile)) {
            try {
                await fs.promises.unlink(this.logFile)
            } catch (error) {
                console.error(`[FileLogger] Failed to clear ${this.logFile}:`, error)
            }
        }
    }

    /** Get the full path to the log file */
    getLogPath(): string {
        return this.logFile
    }

    /**
     * Clear all .log files in a folder
     * @param folder - Subfolder within logger/ (optional)
     * @returns Number of files deleted
     */
    static async clearAll(folder?: string): Promise<number> {
        const dir = path.join(
            process.cwd(),
            FileLogger.BASE_DIR,
            folder || ''
        )

        if (!fs.existsSync(dir)) return 0

        let count = 0
        const files = await fs.promises.readdir(dir)
        for (const file of files) {
            if (file.endsWith('.log')) {
                await fs.promises.unlink(path.join(dir, file))
                count++
            }
        }
        return count
    }
}
