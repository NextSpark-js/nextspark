const mockList = jest.fn();
const mockCreate = jest.fn();
const mockRead = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/core/lib/api/entity/generic-handler', () => ({
  handleGenericList: (...args: unknown[]) => mockList(...args),
  handleGenericCreate: (...args: unknown[]) => mockCreate(...args),
  handleGenericRead: (...args: unknown[]) => mockRead(...args),
  handleGenericUpdate: (...args: unknown[]) => mockUpdate(...args),
  handleGenericDelete: (...args: unknown[]) => mockDelete(...args),
}));

import { executeEntityOperation } from '@/core/lib/mcp/executor';
import type { ToolExecutionContext } from '@/core/lib/mcp/types';

function fakeResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response;
}

const CTX: ToolExecutionContext = {
  userId: 'user-1',
  userRole: 'member',
  teamId: 'team-1',
  authHeader: 'Bearer sk_live_abc',
  apiKeyId: 'key-1',
  scopes: ['customers:read', 'customers:write', 'customers:delete'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue(fakeResponse(200, { success: true, data: [] }));
  mockCreate.mockResolvedValue(fakeResponse(201, { success: true, data: { id: 'new-1' } }));
  mockRead.mockResolvedValue(fakeResponse(200, { success: true, data: { id: 'rec-1' } }));
  mockUpdate.mockResolvedValue(fakeResponse(200, { success: true, data: { id: 'rec-1' } }));
  mockDelete.mockResolvedValue(fakeResponse(200, { success: true }));
});

describe('executeEntityOperation', () => {
  it.each([
    ['list', mockList],
    ['create', mockCreate],
    ['get', mockRead],
    ['update', mockUpdate],
    ['delete', mockDelete],
  ] as const)('injects Authorization and x-team-id headers on %s', async (operation, mock) => {
    await executeEntityOperation({ slug: 'customers', operation, id: 'rec-1' }, CTX);
    const request = mock.mock.calls[0][0];
    expect(request.headers.get('authorization')).toBe('Bearer sk_live_abc');
    expect(request.headers.get('x-team-id')).toBe('team-1');
  });

  it('uses GET and builds a query string for list', async () => {
    await executeEntityOperation(
      { slug: 'customers', operation: 'list', query: { page: '2', limit: '10' } },
      CTX
    );
    const request = mockList.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.url.pathname).toBe('/api/v1/customers');
    expect(request.url.searchParams.get('page')).toBe('2');
    expect(request.url.searchParams.get('limit')).toBe('10');
  });

  it('uses POST with a JSON body + content-type on create', async () => {
    await executeEntityOperation(
      { slug: 'customers', operation: 'create', body: { name: 'Acme' } },
      CTX
    );
    const request = mockCreate.mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.json()).toEqual({ name: 'Acme' });
  });

  it('passes entity + id params to get/update/delete via the second arg', async () => {
    await executeEntityOperation({ slug: 'customers', operation: 'get', id: 'rec-42' }, CTX);
    const [request, ctxArg] = mockRead.mock.calls[0];
    expect(request.url.pathname).toBe('/api/v1/customers/rec-42');
    await expect(ctxArg.params).resolves.toEqual({ entity: 'customers', id: 'rec-42' });
  });

  it('uses PATCH for update and DELETE for delete', async () => {
    await executeEntityOperation({ slug: 'customers', operation: 'update', id: 'rec-1', body: { name: 'x' } }, CTX);
    expect(mockUpdate.mock.calls[0][0].method).toBe('PATCH');

    await executeEntityOperation({ slug: 'customers', operation: 'delete', id: 'rec-1' }, CTX);
    expect(mockDelete.mock.calls[0][0].method).toBe('DELETE');
  });

  it('returns the handler status and parsed JSON body', async () => {
    mockCreate.mockResolvedValueOnce(fakeResponse(201, { success: true, data: { id: 'abc' } }));
    const result = await executeEntityOperation(
      { slug: 'customers', operation: 'create', body: {} },
      CTX
    );
    expect(result).toEqual({ status: 201, body: { success: true, data: { id: 'abc' } } });
  });

  it('propagates handler rejections rather than falling back to network fetch', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'));
    await expect(
      executeEntityOperation({ slug: 'customers', operation: 'list' }, CTX)
    ).rejects.toThrow('boom');
  });

  it('throws for an unsupported/unknown operation instead of silently no-oping', async () => {
    await expect(
      executeEntityOperation({ slug: 'customers', operation: 'bogus' as never }, CTX)
    ).rejects.toThrow('Unsupported entity operation: bogus');
  });

  it('omits empty/undefined query params instead of sending them as empty strings', async () => {
    await executeEntityOperation(
      { slug: 'customers', operation: 'list', query: { search: '', page: '1' } },
      CTX
    );
    const request = mockList.mock.calls[0][0];
    expect(request.url.searchParams.has('search')).toBe(false);
    expect(request.url.searchParams.get('page')).toBe('1');
  });
});
