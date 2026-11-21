const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockQueryRows = jest.fn();
jest.mock('@/core/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

import { isAuthorizationKey, selectedTeam, selectTeam } from '@/core/lib/mcp/oauth/team-selection';

const CHALLENGE_A = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CHALLENGE_B = 'dOMWBmd6s7jgSi2AAmR0ccy-0aAUrUyvi7-v9pYj9hQ';

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryRows.mockResolvedValue([{ id: 'team-1', name: 'One', role: 'owner' }, { id: 'team-2', name: 'Two', role: 'member' }]);
});

describe('the team of an MCP authorization (#541)', () => {
  it('an authorization is named by a PKCE challenge and nothing else', () => {
    expect(isAuthorizationKey(CHALLENGE_A)).toBe(true);
    for (const value of ['', 'short', `${CHALLENGE_A}'; DROP`, 'a'.repeat(129), undefined, null, 42]) expect(isAuthorizationKey(value)).toBe(false);
  });

  it('is stored under the session and the authorization, so two open at once keep their own', async () => {
    mockQueryOne.mockResolvedValueOnce({ teamId: 'team-1' }).mockResolvedValueOnce({ teamId: 'team-2' });
    expect(await selectTeam('session-1', CHALLENGE_A, 'user-1', 'team-1')).toBe('chosen');
    expect(await selectTeam('session-1', CHALLENGE_B, 'user-1', 'team-2')).toBe('chosen');
    expect(mockQueryOne.mock.calls.map(([, params]) => params)).toEqual([['session-1', CHALLENGE_A, 'team-1'], ['session-1', CHALLENGE_B, 'team-2']]);
  });

  it('the first choice stands: it is never overwritten, and choosing another team is refused', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-1' }); // what the table holds after the insert that did nothing
    expect(await selectTeam('session-1', CHALLENGE_A, 'user-1', 'team-2')).toBe('already-chosen');
    expect(await selectTeam('session-1', CHALLENGE_A, 'user-1', 'team-1')).toBe('chosen');
    const [sql] = mockQueryOne.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \("sessionId", "authorization"\) DO NOTHING/);
    expect(sql).not.toMatch(/DO UPDATE/);
  });

  it('a team the user is not a member of is not stored', async () => {
    expect(await selectTeam('session-1', CHALLENGE_A, 'user-1', 'team-9')).toBe('not-a-member');
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('nothing is stored or read without an authorization', async () => {
    expect(await selectTeam('session-1', 'not-a-challenge', 'user-1', 'team-1')).toBe('not-a-member');
    expect(await selectedTeam('session-1', undefined, 'user-1')).toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('is read back for that authorization only, and only while the user is still a member', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-1' });
    expect(await selectedTeam('session-1', CHALLENGE_A, 'user-1')).toBe('team-1');
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(params.slice(0, 3)).toEqual(['session-1', CHALLENGE_A, 'user-1']);
    expect(sql).toMatch(/JOIN "team_members"/);
    expect(sql).toMatch(/s\."authorization" = \$2/);
  });
});
