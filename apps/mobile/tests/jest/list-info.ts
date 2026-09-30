/**
 * `info` of a list response as the API sends it (createApiResponse): the timestamp, then the pagination.
 * There is no `meta` on the wire.
 */
export function listInfo(total: number, page: number, limit: number) {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  }
}
