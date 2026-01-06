import { EventProperties, UserProperties } from '../types/amplitude.types';

export type PIIPattern = {
  regex: RegExp;
  mask: string;
};

export class DataSanitizer {
  public static sanitizeEventProperties(properties: EventProperties | undefined, piiPatterns: PIIPattern[]): EventProperties | undefined {
    if (!properties) return properties;

    const sanitized = { ...properties };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, piiPatterns);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeEventProperties(value, piiPatterns);
      }
    }

    return sanitized;
  }

  public static sanitizeUserProperties(properties: UserProperties | undefined, piiPatterns: PIIPattern[]): UserProperties | undefined {
    if (!properties) return properties;

    const sanitized = { ...properties };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, piiPatterns);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeUserProperties(value, piiPatterns);
      }
    }

    return sanitized;
  }

  private static sanitizeString(text: string, piiPatterns: PIIPattern[]): string {
    let sanitized = text;
    
    for (const pattern of piiPatterns) {
      sanitized = sanitized.replace(pattern.regex, pattern.mask);
    }

    return sanitized;
  }
}

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

export class SlidingWindowRateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry) {
      this.requests.set(identifier, {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      });
      return true;
    }

    // Clean old entries
    if (now - entry.firstRequest > this.windowMs) {
      this.requests.set(identifier, {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      });
      return true;
    }

    // Check if under limit
    if (entry.count < this.maxRequests) {
      entry.count++;
      entry.lastRequest = now;
      return true;
    }

    return false;
  }

  public getRemainingRequests(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry) return this.maxRequests;

    const now = Date.now();
    if (now - entry.firstRequest > this.windowMs) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - entry.count);
  }
}

export type AuditLogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  event: string;
  data: any;
  severity: AuditLogSeverity;
  source: string;
}

export class SecurityAuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number;
  private retentionDays: number;

  constructor(retentionDays: number = 30, maxLogs: number = 10000) {
    this.retentionDays = retentionDays;
    this.maxLogs = maxLogs;
  }

  public log(event: string, data: any, severity: AuditLogSeverity = 'INFO', source: string = 'amplitude-plugin'): void {
    const entry: AuditLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      event,
      data,
      severity,
      source,
    };

    this.logs.push(entry);
    this.cleanup();

    // Log to console for debugging
    const logLevel = severity === 'CRITICAL' || severity === 'ERROR' ? 'error' : 
                    severity === 'WARN' ? 'warn' : 'log';
    console[logLevel](`[Audit] ${event}:`, data);
  }

  public getLogs(startTime?: number, endTime?: number, severity?: AuditLogSeverity): AuditLogEntry[] {
    let filteredLogs = this.logs;

    if (startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startTime);
    }

    if (endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endTime);
    }

    if (severity) {
      filteredLogs = filteredLogs.filter(log => log.severity === severity);
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoffTime = now - (this.retentionDays * 24 * 60 * 60 * 1000);

    // Remove old logs
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

    // Remove excess logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
}

export const dataSanitizer = DataSanitizer;
export const rateLimiter = new SlidingWindowRateLimiter(1000, 60000); // 1000 requests per minute
export const auditLogger = new SecurityAuditLogger(30);
