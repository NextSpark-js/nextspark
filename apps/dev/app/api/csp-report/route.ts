import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * Reports are logged for monitoring and debugging CSP issues.
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

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);

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
      return new Response(null, { status: 204 });
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
