import { NextRequest } from 'next/server';

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * Reports are logged for monitoring and debugging CSP issues.
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

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // CSP reports are sent as application/csp-report or application/json
    if (!contentType.includes('application/csp-report') && !contentType.includes('application/json')) {
      return new Response('Invalid content type', { status: 400 });
    }

    const report: CSPViolationReport = await request.json();
    const violation = report['csp-report'];

    if (!violation) {
      return new Response('Invalid report format', { status: 400 });
    }

    // Log the violation for monitoring
    // In production, you might want to send this to a logging service like Datadog, Sentry, etc.
    console.warn('[CSP Violation]', {
      documentUri: violation['document-uri'],
      blockedUri: violation['blocked-uri'],
      violatedDirective: violation['violated-directive'],
      effectiveDirective: violation['effective-directive'],
      sourceFile: violation['source-file'],
      lineNumber: violation['line-number'],
      timestamp: new Date().toISOString(),
    });

    // Return 204 No Content - browsers don't expect a response body
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[CSP Report Error]', error);
    // Still return 204 to not break browser behavior
    return new Response(null, { status: 204 });
  }
}

// Also handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
