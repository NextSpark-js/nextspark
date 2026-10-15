import type { NextRequest } from 'next/server';

/** Largest page size any list endpoint serves. */
export const MAX_PAGE_SIZE = 100;

/**
 * Parsea y valida parámetros de paginación.
 * A value that is not a number falls back to the default; the page is at least 1 and the limit is clamped to 1..maxLimit.
 */
export function parsePaginationParams(request: NextRequest, defaultLimit: number = 10, maxLimit: number = MAX_PAGE_SIZE): {
  page: number;
  limit: number;
  offset: number;
} {
  const { searchParams } = new URL(request.url);

  const toInt = (value: string | null, fallback: number) => {
    const parsed = parseInt(value ?? '', 10);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  };

  const page = Math.min(Math.floor(Number.MAX_SAFE_INTEGER / (maxLimit + 1)), Math.max(1, toInt(searchParams.get('page'), 1)));
  const limit = Math.min(maxLimit, Math.max(1, toInt(searchParams.get('limit'), defaultLimit)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
