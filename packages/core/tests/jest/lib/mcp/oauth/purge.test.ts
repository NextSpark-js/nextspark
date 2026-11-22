const mockQuery = jest.fn();
jest.mock('@/core/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { PURGE_BATCH, purgeExpiredOAuth, purgeExpiredOAuthIfDue, resetOAuthPurgeClock } from '@/core/lib/mcp/oauth/purge';

const statements = () => mockQuery.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
const deleted = (rowCount: number) => ({ rows: [], rowCount });

let infoSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetOAuthPurgeClock();
  mockQuery.mockResolvedValue(deleted(0));
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('housekeeping of the authorization server\'s tables (#541)', () => {
  it('removes what expired more than a day ago and says how much of each', async () => {
    mockQuery
      .mockResolvedValueOnce(deleted(5)) // access tokens
      .mockResolvedValueOnce(deleted(3)) // refresh tokens
      .mockResolvedValueOnce(deleted(2)) // client assertions
      .mockResolvedValueOnce(deleted(1)) // team selections
      .mockResolvedValueOnce(deleted(4)) // revocations
      .mockResolvedValueOnce(deleted(1)); // signing keys
    expect(await purgeExpiredOAuth()).toEqual({ accessTokens: 5, refreshTokens: 3, clientAssertions: 2, teamSelections: 1, revocations: 4, signingKeys: 1 });
    const [access, refresh, assertions, selections, revocations, keys] = statements();
    expect(access).toMatch(/^DELETE FROM "oauthAccessToken" WHERE id IN \( SELECT id FROM "oauthAccessToken" WHERE "expiresAt" < now\(\) - interval '1 day'/);
    expect(refresh).toMatch(/^DELETE FROM "oauthRefreshToken" WHERE id IN \( SELECT id FROM "oauthRefreshToken" WHERE "expiresAt" < now\(\) - interval '1 day'/);
    expect(assertions).toMatch(/^DELETE FROM "oauthClientAssertion" .*"expiresAt" < now\(\) - interval '1 day'/);
    expect(selections).toMatch(/^DELETE FROM "oauthTeamSelection" .*"createdAt" < now\(\) - interval '1 day'/);
    expect(revocations).toMatch(/^DELETE FROM "oauthRevocation" /);
    // a replaced signing key goes only after the 30 days it stays published, and one that never expires never goes
    expect(keys).toMatch(/^DELETE FROM "jwks" .*"expiresAt" < now\(\) - interval '31 days'/);
  });

  it('a refresh token goes by its own expiry only: one that was replaced or revoked stays until then', async () => {
    await purgeExpiredOAuth();
    const refresh = statements()[1];
    // the authorization server needs the row of a replaced token to recognise it presented again
    expect(refresh).not.toMatch(/revoked|rotatedAt/);
    expect(refresh.match(/interval '1 day'/g)).toHaveLength(1);
  });

  it('every statement removes a bounded number of rows and skips the ones another instance is removing', async () => {
    await purgeExpiredOAuth();
    for (const statement of statements()) {
      expect(statement).toContain(`LIMIT ${PURGE_BATCH} FOR UPDATE SKIP LOCKED`);
      // counted by the database: no row is sent back to be counted here
      expect(statement).not.toMatch(/RETURNING/);
    }
    expect(PURGE_BATCH).toBeLessThanOrEqual(5000);
  });

  it('keeps each user\'s newest revocation whatever its age: it is the number their next token carries', async () => {
    await purgeExpiredOAuth();
    expect(statements()[4]).toMatch(/id < \(SELECT MAX\(newest\.id\) FROM "oauthRevocation" newest WHERE newest\."userId" = "oauthRevocation"\."userId"\)/);
  });

  it('runs at most once an hour per process', async () => {
    const start = 1_800_000_000_000;
    expect(await purgeExpiredOAuthIfDue(start)).not.toBeNull();
    expect(await purgeExpiredOAuthIfDue(start + 59 * 60 * 1000)).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(6);
    expect(await purgeExpiredOAuthIfDue(start + 60 * 60 * 1000)).not.toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(12);
  });

  it('a purge that fails is reported and never thrown: the token being issued is not its victim', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    await expect(purgeExpiredOAuthIfDue(1_800_000_000_000)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // and it waits its hour before trying again, instead of retrying on every token
    expect(await purgeExpiredOAuthIfDue(1_800_000_000_000 + 1000)).toBeNull();
  });

  it('says what it removed only when it removed something', async () => {
    await purgeExpiredOAuthIfDue(1_800_000_000_000);
    expect(infoSpy).not.toHaveBeenCalled();
    resetOAuthPurgeClock();
    mockQuery.mockResolvedValueOnce(deleted(2));
    await purgeExpiredOAuthIfDue(1_800_000_000_000);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });
});
