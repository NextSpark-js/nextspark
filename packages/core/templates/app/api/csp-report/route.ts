import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

// Dynamic import for rate limiting - graceful fallback if not available
let checkDistributedRateLimit: ((id: string, tier: string) => Promise<{ allowed: boolean; limit: number; remaining: number; resetTime: number; retryAfter?: number }>) | null = null;
let createRateLimitErrorResponse: ((result: { allowed: boolean; limit: number; remaining: number; resetTime: number; retryAfter?: number }) => NextResponse) | null = null;

// Try to load rate limiting functions
try {
  const rateLimitModule = require('@nextsparkjs/core/lib/api');
  checkDistributedRateLimit = rateLimitModule.checkDistributedRateLimit;
  createRateLimitErrorResponse = rateLimitModule.createRateLimitErrorResponse;
} catch {
  // Rate limiting not available - will skip rate limit checks
  console.warn('[CSP Report] Rate limiting not available - running without rate limits');
}

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * Reports are logged for monitoring and debugging CSP issues.
 *
 * Rate limiting: Uses 'api' tier (100 requests/minute per IP) to prevent abuse.
 * Falls back gracefully if rate limiting is not available.
 *
 * NOTE: This file exists in both apps/dev/app/api/csp-report/ and
 * packages/core/templates/app/api/csp-report/. The template version
 * is used when creating new projects from the core package.
 * Changes should be synchronized between both files.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_report_syntax
 */

interface CSPViolationReport {
  'csp-report'?: {
    'document-uri'?: string;
    'referrer'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'disposition'?: string;
    'blocked-uri'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
    'script-sample'?: string;
  };
}

// Get allowed origin from environment or use localhost fallback
const getAllowedOrigin = () => {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

/**
 * Get client IP address from request headers.
 * Handles various proxy scenarios (X-Forwarded-For, X-Real-IP, etc.)
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  return 'unknown';
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  let rateLimitHeaders: Record<string, string> = {};

  // Rate limiting: 100 requests per minute per IP (api tier)
  // Skip if rate limiting is not available
  if (checkDistributedRateLimit && createRateLimitErrorResponse) {
    try {
      const clientIp = getClientIp(request);
      const rateLimitResult = await checkDistributedRateLimit(`csp-report:ip:${clientIp}`, 'api');

      if (!rateLimitResult.allowed) {
        console.warn(`[CSP Report ${requestId}] Rate limit exceeded for IP: ${clientIp}`);
        return createRateLimitErrorResponse(rateLimitResult);
      }

      // Store rate limit headers to include in response
      rateLimitHeaders = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
      };
    } catch (rateLimitError) {
      // Log but continue without rate limiting
      console.warn(`[CSP Report ${requestId}] Rate limit check failed, continuing without:`, {
        error: rateLimitError instanceof Error ? rateLimitError.message : 'Unknown error',
      });
    }
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // CSP reports are sent as application/csp-report or application/json
    if (!contentType.includes('application/csp-report') && !contentType.includes('application/json')) {
      console.warn(`[CSP Report ${requestId}] Invalid content-type: ${contentType}`);
      return new Response('Invalid content type', { status: 400 });
    }

    let rawBody: string | undefined;
    try {
      rawBody = await request.text();
      const report: CSPViolationReport = JSON.parse(rawBody);
      const violation = report['csp-report'];

      if (!violation) {
        console.warn(`[CSP Report ${requestId}] Invalid report format - missing csp-report key`, {
          bodyPreview: rawBody.slice(0, 200),
        });
        return new Response('Invalid report format', { status: 400 });
      }

      // Log the violation for monitoring
      // In production, you might want to send this to a logging service like Datadog, Sentry, etc.
      console.warn(`[CSP Violation ${requestId}]`, {
        documentUri: violation['document-uri'],
        blockedUri: violation['blocked-uri'],
        violatedDirective: violation['violated-directive'],
        effectiveDirective: violation['effective-directive'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number'],
        scriptSample: violation['script-sample'],
        disposition: violation['disposition'],
        timestamp: new Date().toISOString(),
      });

      // Return 204 No Content - browsers don't expect a response body
      return new Response(null, {
        status: 204,
        headers: rateLimitHeaders,
      });
    } catch (parseError) {
      console.error(`[CSP Report ${requestId}] JSON parse error:`, {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        bodyPreview: rawBody?.slice(0, 200),
      });
      // Still return 204 to not break browser behavior
      return new Response(null, { status: 204 });
    }
  } catch (error) {
    console.error(`[CSP Report ${requestId}] Unexpected error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Still return 204 to not break browser behavior
    return new Response(null, { status: 204 });
  }
}

// Handle preflight requests for CORS
// Restrict to same origin instead of allowing all origins
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
