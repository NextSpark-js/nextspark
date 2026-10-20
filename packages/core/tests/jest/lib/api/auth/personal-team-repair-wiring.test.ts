/**
 * #324: the session path of authenticateRequest repairs a user without a team on the request that finds none, and
 * only then; an API key request does not.
 */
const mockRepair = jest.fn();
jest.mock('@/core/lib/auth/personal-team-repair', () => ({
  repairMissingPersonalTeam: (...args: unknown[]) => mockRepair(...args),
}));
jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn().mockResolvedValue(null) }));
const mockGetSession = jest.fn();
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));
const mockQueryOne = jest.fn();
jest.mock('@/core/lib/db', () => ({ queryOne: (...args: unknown[]) => mockQueryOne(...args) }));
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }));
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }));

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth';

function makeRequest(): NextRequest {
  const url = 'http://localhost/api/v1/teams';
  const req = new (NextRequest as unknown as { new (url: string): NextRequest })(url);
  (req as unknown as { nextUrl: URL }).nextUrl = new URL(url);
  return req;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: 'u1', email: 'u1@test.dev', role: 'member', name: 'U' }, session: { id: 's1' } });
});

describe('authenticateRequest: personal team repair (#324)', () => {
  it('a session user without a team gets the repaired team as its default', async () => {
    mockQueryOne.mockResolvedValue(null);
    mockRepair.mockResolvedValue('team-new');

    const result = await authenticateRequest(makeRequest());

    expect(mockRepair).toHaveBeenCalledWith('u1');
    expect(result.user?.defaultTeamId).toBe('team-new');
  });

  it('a session user with a team is not looked at again', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-1' });

    const result = await authenticateRequest(makeRequest());

    expect(mockRepair).not.toHaveBeenCalled();
    expect(result.user?.defaultTeamId).toBe('team-1');
  });

  it('a repair that finds nothing to do leaves the request without a default team', async () => {
    mockQueryOne.mockResolvedValue(null);
    mockRepair.mockResolvedValue(undefined);

    const result = await authenticateRequest(makeRequest());

    expect(result.success).toBe(true);
    expect(result.user?.defaultTeamId).toBeUndefined();
  });
});
