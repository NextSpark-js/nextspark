const mockMutateWithRLS = jest.fn();
jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}));

import { auditToolCall, namesSecret, redactSecrets } from '@/core/lib/mcp/audit';
import type { AuditEntry } from '@/core/lib/mcp/types';

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    apiKeyId: 'key-1',
    userId: 'user-1',
    tool: 'acme_create_customer',
    entitySlug: 'customers',
    operation: 'create',
    recordId: undefined,
    teamId: 'team-1',
    statusCode: 200,
    requestSummary: { name: 'Acme' },
    responseTimeMs: 42,
    ...overrides,
  };
}

let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('auditToolCall', () => {
  it('inserts into api_audit_log with an mcp:<tool> endpoint prefix', async () => {
    await auditToolCall(entry());
    expect(mockMutateWithRLS).toHaveBeenCalledTimes(1);
    const [sql, params, userId] = mockMutateWithRLS.mock.calls[0];
    expect(sql).toContain('api_audit_log');
    expect(params[0]).toBe('key-1'); // apiKeyId
    expect(params[1]).toBe('user-1'); // userId
    expect(params[2]).toBe('mcp:acme_create_customer'); // endpoint
    expect(params[3]).toBe('CREATE'); // method (uppercased operation)
    expect(params[4]).toBe(200); // statusCode
    // Passes userId as RLS context, matching logApiUsage's pattern.
    expect(userId).toBe('user-1');
  });

  it('serializes tool/entity/operation/args into the requestBody JSON', async () => {
    await auditToolCall(entry({ recordId: 'rec-1' }));
    const [, params] = mockMutateWithRLS.mock.calls[0];
    const requestBody = JSON.parse(params[7]);
    expect(requestBody).toEqual({
      tool: 'acme_create_customer',
      entity: 'customers',
      operation: 'create',
      recordId: 'rec-1',
      teamId: 'team-1',
      args: { name: 'Acme' },
    });
  });

  it('uses "workflow" as the method for tools with no entity operation', async () => {
    await auditToolCall(entry({ operation: undefined, entitySlug: undefined }));
    const [, params] = mockMutateWithRLS.mock.calls[0];
    expect(params[3]).toBe('WORKFLOW');
  });

  it('truncates an oversized requestSummary instead of writing it whole', async () => {
    const huge = { blob: 'x'.repeat(5000) };
    await auditToolCall(entry({ requestSummary: huge }));
    const [, params] = mockMutateWithRLS.mock.calls[0];
    const requestBody = JSON.parse(params[7]);
    expect(requestBody.args.truncated).toBe(true);
    expect(requestBody.args.preview.length).toBeLessThanOrEqual(4000);
  });

  it('warns and skips the DB write when apiKeyId is missing, without throwing', async () => {
    await expect(auditToolCall(entry({ apiKeyId: null }))).resolves.toBeUndefined();
    expect(mockMutateWithRLS).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws when the DB write fails — logs instead', async () => {
    mockMutateWithRLS.mockRejectedValueOnce(new Error('db down'));
    await expect(auditToolCall(entry())).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('auditToolCall for an OAuth access token (#541)', () => {
  it('records the call with no api key and the OAuth client and token id in the body', async () => {
    await auditToolCall(entry({ apiKeyId: null, oauth: { clientId: 'https://client.example/metadata.json', tokenId: 'jti-1' } }));
    expect(mockMutateWithRLS).toHaveBeenCalledTimes(1);
    const [, params] = mockMutateWithRLS.mock.calls[0];
    expect(params[0]).toBeNull();
    expect(JSON.parse(params[7])).toMatchObject({ credential: 'oauth', oauthClientId: 'https://client.example/metadata.json', oauthTokenId: 'jti-1' });
  });

  it('still skips a call that has neither an api key nor an OAuth client', async () => {
    await auditToolCall(entry({ apiKeyId: null }));
    expect(mockMutateWithRLS).not.toHaveBeenCalled();
  });
});

describe('what the audit trail keeps of a call (#541)', () => {
  it('the value of a key that names a secret is replaced, at any depth', () => {
    expect(redactSecrets({
      name: 'Acme',
      password: 'hunter2',
      apiKey: 'sk_live_1',
      nested: { access_token: 'abc', list: [{ clientSecret: 'x', label: 'ok' }] },
      authorization: null,
    })).toEqual({
      name: 'Acme',
      password: '[redacted]',
      apiKey: '[redacted]',
      nested: { access_token: '[redacted]', list: [{ clientSecret: '[redacted]', label: 'ok' }] },
      authorization: null,
    });
  });

  it('a key names a secret by its words, not by a run of letters inside it', () => {
    for (const key of ['password', 'newPassword', 'passwordHash', 'clientSecret', 'client_secret', 'apiKey', 'api-key', 'API_KEY', 'privateKey', 'accessToken', 'access_token', 'refreshToken', 'token', 'tokenHash', 'Authorization', 'bearer', 'otp', 'otpCode', 'pin', 'cvv', 'ssn', 'credentials', 'apikey', 'accesstoken', 'clientsecret']) {
      expect([key, namesSecret(key)]).toEqual([key, true]);
    }
    // fields an entity may well have
    for (const key of ['tokenCount', 'tokenLimit', 'tokensUsed', 'secretaryName', 'keyResults', 'key', 'keyword', 'pinned', 'spinner', 'passenger', 'name', 'authorId', 'description']) {
      expect([key, namesSecret(key)]).toEqual([key, false]);
    }
  });

  it('arguments are written redacted', async () => {
    await auditToolCall(entry({ requestSummary: { name: 'Acme', password: 'hunter2' } }));
    const requestBody = JSON.parse(mockMutateWithRLS.mock.calls[0][1][7]);
    expect(requestBody.args).toEqual({ name: 'Acme', password: '[redacted]' });
  });

  it('a call refused for missing scopes says so, with the scopes', async () => {
    await auditToolCall(entry({ apiKeyId: null, oauth: { clientId: 'https://client.example/meta' }, statusCode: 403, missingScopes: ['customers:write'] }));
    const [, params] = mockMutateWithRLS.mock.calls[0];
    expect(params[4]).toBe(403);
    expect(JSON.parse(params[7])).toMatchObject({ refused: 'insufficient_scope', missingScopes: ['customers:write'], credential: 'oauth' });
  });

  it('a call that ran has no refusal fields', async () => {
    await auditToolCall(entry());
    expect(JSON.parse(mockMutateWithRLS.mock.calls[0][1][7])).not.toHaveProperty('refused');
  });
});
