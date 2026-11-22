const mockQueryRows = jest.fn();
jest.mock('@/core/lib/db', () => ({
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

import { purgeExpiredOAuth, purgeExpiredOAuthIfDue, resetOAuthPurgeClock } from '@/core/lib/mcp/oauth/purge';

const statements = () => mockQueryRows.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

let infoSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetOAuthPurgeClock();
  mockQueryRows.mockResolvedValue([]);
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('housekeeping of the authorization server\'s tables (#541)', () => {
  it('removes what expired or ended more than a day ago and says how much of each', async () => {
    mockQueryRows
      .mockResolvedValueOnce(rows(5)) // access tokens
      .mockResolvedValueOnce(rows(3)) // refresh tokens
      .mockResolvedValueOnce(rows(2)) // client assertions
      .mockResolvedValueOnce(rows(1)) // team selections
      .mockResolvedValueOnce(rows(4)) // revocations
      .mockResolvedValueOnce(rows(1)); // signing keys
    expect(await purgeExpiredOAuth()).toEqual({ accessTokens: 5, refreshTokens: 3, clientAssertions: 2, teamSelections: 1, revocations: 4, signingKeys: 1 });
    const [access, refresh, assertions, selections, revocations, keys] = statements();
    // a replaced signing key goes only after the 30 days it stays published, and one that never expires never goes
    expect(keys).toMatch(/^DELETE FROM "jwks" WHERE "expiresAt" < now\(\) - interval '31 days'/);
    expect(access).toMatch(/^DELETE FROM "oauthAccessToken" WHERE "expiresAt" < now\(\) - interval '1 day'/);
    expect(refresh).toMatch(/^DELETE FROM "oauthRefreshToken" WHERE "expiresAt" < now\(\) - interval '1 day' OR revoked < now\(\) - interval '1 day'/);
    expect(assertions).toMatch(/^DELETE FROM "oauthClientAssertion" WHERE "expiresAt" < now\(\) - interval '1 day'/);
    expect(selections).toMatch(/^DELETE FROM "oauthTeamSelection" WHERE "createdAt" < now\(\) - interval '1 day'/);
    expect(revocations).toMatch(/^DELETE FROM "oauthRevocation" old/);
  });

  it('never names a live refresh token: only one that expired or was revoked, a day ago', async () => {
    await purgeExpiredOAuth();
    const refresh = statements()[1];
    // every condition carries the day of margin; none is "revoked IS NOT NULL" or "expiresAt < now()" alone
    expect(refresh.match(/interval '1 day'/g)).toHaveLength(2);
    expect(refresh).not.toMatch(/revoked IS NOT NULL|"expiresAt" < now\(\)(?! - interval)/);
  });

  it('keeps each user\'s newest revocation whatever its age: it is the number their next token carries', async () => {
    await purgeExpiredOAuth();
    expect(statements()[4]).toMatch(/old\.id < \(SELECT MAX\(newest\.id\) FROM "oauthRevocation" newest WHERE newest\."userId" = old\."userId"\)/);
  });

  it('runs at most once an hour per process', async () => {
    const start = 1_800_000_000_000;
    expect(await purgeExpiredOAuthIfDue(start)).not.toBeNull();
    expect(await purgeExpiredOAuthIfDue(start + 59 * 60 * 1000)).toBeNull();
    expect(mockQueryRows).toHaveBeenCalledTimes(6);
    expect(await purgeExpiredOAuthIfDue(start + 60 * 60 * 1000)).not.toBeNull();
    expect(mockQueryRows).toHaveBeenCalledTimes(12);
  });

  it('a purge that fails is reported and never thrown: the token being issued is not its victim', async () => {
    mockQueryRows.mockRejectedValueOnce(new Error('connection lost'));
    await expect(purgeExpiredOAuthIfDue(1_800_000_000_000)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // and it waits its hour before trying again, instead of retrying on every token
    expect(await purgeExpiredOAuthIfDue(1_800_000_000_000 + 1000)).toBeNull();
  });

  it('says what it removed only when it removed something', async () => {
    await purgeExpiredOAuthIfDue(1_800_000_000_000);
    expect(infoSpy).not.toHaveBeenCalled();
    resetOAuthPurgeClock();
    mockQueryRows.mockResolvedValueOnce(rows(2));
    await purgeExpiredOAuthIfDue(1_800_000_000_000);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });
});
