import { translateApiError } from '@/core/lib/mcp/errors';
import type { EntityApiResult } from '@/core/lib/mcp/types';

function result(status: number, body: Partial<EntityApiResult['body']> = {}): EntityApiResult {
  return { status, body: { success: false, ...body } };
}

describe('translateApiError', () => {
  it('maps AUTHENTICATION_FAILED to an actionable message regardless of status', () => {
    const msg = translateApiError(result(401, { code: 'AUTHENTICATION_FAILED' }), {
      slug: 'customers',
      operation: 'list',
    });
    expect(msg).toContain('API key inválida');
  });

  it('maps TEAM_ACCESS_DENIED', () => {
    const msg = translateApiError(result(403, { code: 'TEAM_ACCESS_DENIED' }), {
      slug: 'customers',
      operation: 'list',
    });
    expect(msg).toContain('no es miembro del team');
  });

  it('maps INVALID_FIELD_VALUE, including the API detail when present', () => {
    const msg = translateApiError(result(400, { code: 'INVALID_FIELD_VALUE', error: 'bad enum' }), {
      slug: 'customers',
      operation: 'create',
    });
    expect(msg).toContain('valor no permitido');
    expect(msg).toContain('bad enum');
  });

  it('maps RATE_LIMIT_EXCEEDED by code (distinct message from the 429 status fallback)', () => {
    const msg = translateApiError(result(429, { code: 'RATE_LIMIT_EXCEEDED' }), {
      slug: 'customers',
      operation: 'list',
    });
    expect(msg).toContain('batch');
  });

  it('429 without a matching code falls back to the plain rate-limit status message', () => {
    const msg = translateApiError(result(429), { slug: 'customers', operation: 'list' });
    expect(msg).toContain('Límite de requests alcanzado');
    expect(msg).not.toContain('batch');
  });

  it('formatDetails handles a non-array details value as an opaque JSON blob', () => {
    const msg = translateApiError(
      result(400, { code: 'VALIDATION_ERROR', details: { reason: 'bad' } }),
      { slug: 'customers', operation: 'create' }
    );
    expect(msg).toContain('Detalle:');
    expect(msg).toContain('"reason":"bad"');
  });

  it('formatDetails handles a non-object array entry by stringifying it directly', () => {
    const msg = translateApiError(
      result(400, { code: 'VALIDATION_ERROR', details: ['email is required'] }),
      { slug: 'customers', operation: 'create' }
    );
    expect(msg).toContain('email is required');
  });

  it('maps TEAM_CONTEXT_REQUIRED', () => {
    const msg = translateApiError(result(400, { code: 'TEAM_CONTEXT_REQUIRED' }), {
      slug: 'customers',
      operation: 'create',
    });
    expect(msg).toContain('x-team-id');
  });

  it('VALIDATION_ERROR with no details omits the "Problemas"/"Detalle" suffix entirely', () => {
    const msg = translateApiError(result(400, { code: 'VALIDATION_ERROR' }), {
      slug: 'customers',
      operation: 'create',
    });
    expect(msg).toBe('Datos inválidos para customers. Corregí los campos y reintentá.');
  });

  it('a validation issue with no path renders as a bare message, and falls back to JSON when message is missing', () => {
    const msg = translateApiError(
      result(400, {
        code: 'VALIDATION_ERROR',
        details: [{ code: 'custom' }],
      }),
      { slug: 'customers', operation: 'create' }
    );
    expect(msg).toContain('{"code":"custom"}');
    expect(msg).not.toMatch(/^\w+:/);
  });

  it('includes validation issue details for VALIDATION_ERROR', () => {
    const msg = translateApiError(
      result(400, {
        code: 'VALIDATION_ERROR',
        details: [{ path: ['email'], message: 'Invalid email' }],
      }),
      { slug: 'customers', operation: 'create' }
    );
    expect(msg).toContain('customers');
    expect(msg).toContain('email: Invalid email');
  });

  it('falls back to a generic unique-constraint message for any entity', () => {
    const msg = translateApiError(result(409, { code: 'UNIQUE_CONSTRAINT_VIOLATION' }), {
      slug: 'invoices',
      operation: 'create',
    });
    expect(msg).toContain('invoices');
    expect(msg.toLowerCase()).toContain('ya existe');
  });

  it('scopeFor delete resolves to :delete (post #94/#95 fix), not :write', () => {
    const msg = translateApiError(result(403), { slug: 'customers', operation: 'delete' });
    expect(msg).toContain('customers:delete');
    expect(msg).not.toContain('customers:write');
  });

  it('scopeFor list/get resolves to :read', () => {
    const msg = translateApiError(result(403), { slug: 'customers', operation: 'list' });
    expect(msg).toContain('customers:read');
  });

  it('scopeFor create/update resolves to :write', () => {
    const msg = translateApiError(result(403), { slug: 'customers', operation: 'update' });
    expect(msg).toContain('customers:write');
  });

  it('401 with no matching code falls back to the plain not-authenticated status message', () => {
    const msg = translateApiError(result(401), { slug: 'customers', operation: 'list' });
    expect(msg).toContain('No autenticado');
  });

  it('404 mentions the entity and suggests using list', () => {
    const msg = translateApiError(result(404), { slug: 'customers', operation: 'get' });
    expect(msg.toLowerCase()).toContain('list');
  });

  it('409 includes API detail when present', () => {
    const msg = translateApiError(result(409, { error: 'FK violation' }), {
      slug: 'customers',
      operation: 'delete',
    });
    expect(msg).toContain('FK violation');
  });

  it('500 appends override errorHints when provided', () => {
    const msg = translateApiError(result(500), {
      slug: 'mealplans',
      operation: 'create',
      hints: ['weekStart must be a Monday'],
    });
    expect(msg).toContain('weekStart must be a Monday');
  });

  it('500 without hints omits the "posibles causas" clause', () => {
    const msg = translateApiError(result(500), { slug: 'customers', operation: 'create' });
    expect(msg).not.toContain('Posibles causas');
  });

  it('unknown status/code falls back to a generic message with the code', () => {
    const msg = translateApiError(result(418, { code: 'IM_A_TEAPOT' }), {
      slug: 'customers',
      operation: 'create',
    });
    expect(msg).toContain('418');
    expect(msg).toContain('IM_A_TEAPOT');
  });

  it('derives HTTP_<status> as the code when body.code is absent', () => {
    const msg = translateApiError(result(418), { slug: 'customers', operation: 'create' });
    expect(msg).toContain('HTTP_418');
  });
});
