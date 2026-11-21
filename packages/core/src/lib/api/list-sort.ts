import type { NextRequest } from 'next/server';

export type SortOrder = 'asc' | 'desc';

/**
 * The `sort` and `order` query params of a list endpoint as an ORDER BY clause. `columns` maps each sort key the endpoint
 * accepts to its SQL expression, so a key that is not in it (the params come from the URL) never reaches the SQL: the
 * `fallback` key and direction apply instead. `id` breaks ties, so a page boundary does not move between requests.
 */
export function parseSort(
  request: NextRequest,
  columns: Record<string, string>,
  fallback: { key: string; order: SortOrder },
  tiebreaker = 'id'
): { key: string; order: SortOrder; orderBy: string } {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('sort') ?? '';
  const known = Object.prototype.hasOwnProperty.call(columns, requested);
  const key = known ? requested : fallback.key;
  const order: SortOrder = known
    ? searchParams.get('order') === 'asc' ? 'asc' : searchParams.get('order') === 'desc' ? 'desc' : fallback.order
    : fallback.order;
  return { key, order, orderBy: `${columns[key]} ${order.toUpperCase()}, ${tiebreaker}` };
}
