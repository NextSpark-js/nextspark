import { NextRequest, NextResponse } from 'next/server';
import { MAX_SEARCH_TERM_LENGTH, searchTermLength } from '../utils/like-pattern';

// Kept apart from helpers.ts, which pulls in the database and auth: a route that only answers errors imports this one.

/**
 * Crea una respuesta de error estandarizada para la API
 */
export function createApiError(
  message: string, 
  status: number = 400, 
  details?: unknown,
  code?: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({
    ...extra,
    success: false,
    error: message,
    code: code || `HTTP_${status}`,
    details,
    info: {
      timestamp: new Date().toISOString()
    }
  }, { status });
}

/**
 * Reads the request body as a JSON object. A missing, empty or non-JSON body, and a JSON value that is not an
 * object (null, number, text, boolean, array), come back as a 400 INVALID_JSON response in `error`.
 */
export async function readJsonObject(request: NextRequest): Promise<
  { data: Record<string, unknown>; error?: undefined } | { data?: undefined; error: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: createApiError('Request body must be valid JSON', 400, undefined, 'INVALID_JSON') };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: createApiError('Request body must be a JSON object', 400, undefined, 'INVALID_JSON') };
  }
  return { data: body as Record<string, unknown> };
}

/** The 400 SEARCH_TERM_TOO_LONG answer for a search term over MAX_SEARCH_TERM_LENGTH characters (trimmed), else null. */
export function searchTermTooLongError(term: string | null | undefined): NextResponse | null {
  if (!term || searchTermLength(term.trim()) <= MAX_SEARCH_TERM_LENGTH) return null;
  return createApiError(
    `The search term is too long: at most ${MAX_SEARCH_TERM_LENGTH} characters`,
    400,
    { maxLength: MAX_SEARCH_TERM_LENGTH },
    'SEARCH_TERM_TOO_LONG'
  );
}
