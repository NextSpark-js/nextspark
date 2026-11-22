/**
 * /api/internal/oauth-connections (#541): the signed-in user lists and ends their own MCP connections, and those of
 * other members only in a team whose integrations they manage.
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/cors-response', () => ({ corsPreflight: jest.fn() }))
const getSession = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: (...args: unknown[]) => getSession(...args) }))
const enabled = jest.fn()
jest.mock('@nextsparkjs/core/lib/mcp/oauth/config', () => ({ isMcpOAuthEnabled: () => enabled() }))
const connections = {
  userConnections: jest.fn(),
  managedConnections: jest.fn(),
  disconnectManaged: jest.fn(),
  disconnect: jest.fn(),
}
jest.mock('@nextsparkjs/core/lib/mcp/oauth/connections', () => ({
  userConnections: (...args: unknown[]) => connections.userConnections(...args),
  managedConnections: (...args: unknown[]) => connections.managedConnections(...args),
  disconnectManaged: (...args: unknown[]) => connections.disconnectManaged(...args),
  disconnect: (...args: unknown[]) => connections.disconnect(...args),
}))

import { DELETE, GET } from '../../../src/routes/api/internal/oauth-connections/route'

const URL = 'http://localhost:3000/api/internal/oauth-connections'
const get = () => GET(new NextRequest(URL), undefined as never)
const del = (body: unknown) =>
  DELETE(new NextRequest(URL, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), undefined as never)

beforeEach(() => {
  jest.clearAllMocks()
  enabled.mockReturnValue(true)
  getSession.mockResolvedValue({ user: { id: 'user-1', role: 'member' }, session: { id: 'session-1' } })
  connections.userConnections.mockResolvedValue([{ clientId: 'client-a', teamId: 'team-1' }])
  connections.managedConnections.mockResolvedValue([{ clientId: 'client-b', teamId: 'team-1', userId: 'user-2' }])
  connections.disconnectManaged.mockResolvedValue(false)
  connections.disconnect.mockResolvedValue(true)
})

describe('/api/internal/oauth-connections', () => {
  it('is not there while the feature is off, and reads nothing', async () => {
    enabled.mockReturnValue(false)
    expect((await get()).status).toBe(404)
    expect((await del({ clientId: 'client-a', teamId: 'team-1' })).status).toBe(404)
    expect(getSession).not.toHaveBeenCalled()
    expect(connections.disconnect).not.toHaveBeenCalled()
  })

  it('needs a session', async () => {
    getSession.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
    expect((await del({ clientId: 'client-a', teamId: 'team-1' })).status).toBe(401)
    expect(connections.disconnect).not.toHaveBeenCalled()
  })

  it('lists the user\'s own connections and the ones of the teams they run', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: [{ clientId: 'client-a', teamId: 'team-1' }],
      managed: [{ clientId: 'client-b', teamId: 'team-1', userId: 'user-2' }],
    })
    expect(connections.userConnections).toHaveBeenCalledWith('user-1')
    expect(connections.managedConnections).toHaveBeenCalledWith('user-1', 'member')
  })

  it('ends the user\'s own connection without asking who manages the team', async () => {
    expect((await del({ clientId: 'client-a', teamId: 'team-1' })).status).toBe(200)
    expect(connections.disconnect).toHaveBeenCalledWith('user-1', 'client-a', 'team-1')
    expect(connections.disconnectManaged).not.toHaveBeenCalled()
  })

  it('naming oneself as the user is one\'s own connection too', async () => {
    expect((await del({ clientId: 'client-a', teamId: 'team-1', userId: 'user-1' })).status).toBe(200)
    expect(connections.disconnect).toHaveBeenCalledWith('user-1', 'client-a', 'team-1')
    expect(connections.disconnectManaged).not.toHaveBeenCalled()
  })

  it('another member\'s connection goes through the check of who manages the team, and a refusal is a 404', async () => {
    const response = await del({ clientId: 'client-b', teamId: 'team-1', userId: 'user-2' })
    expect(response.status).toBe(404)
    expect(connections.disconnectManaged).toHaveBeenCalledWith('user-1', 'member', 'user-2', 'client-b', 'team-1')
    // never the unchecked path for somebody else's connection
    expect(connections.disconnect).not.toHaveBeenCalled()
  })

  it('ends another member\'s connection to a team whose integrations the user manages', async () => {
    connections.disconnectManaged.mockResolvedValue(true)
    expect((await del({ clientId: 'client-b', teamId: 'team-1', userId: 'user-2' })).status).toBe(200)
    expect(connections.disconnect).not.toHaveBeenCalled()
  })

  it('answers 404 for a connection that is not there', async () => {
    connections.disconnect.mockResolvedValue(false)
    expect((await del({ clientId: 'gone', teamId: 'team-1' })).status).toBe(404)
  })

  it('answers 400 for a body that does not name a client and a team, or names a user badly', async () => {
    for (const body of [{}, { clientId: 'client-a' }, { teamId: 'team-1' }, { clientId: '', teamId: 'team-1' }, { clientId: 'client-a', teamId: 7 }, { clientId: 'client-a', teamId: 'team-1', userId: '' }, { clientId: 'client-a', teamId: 'team-1', userId: 5 }]) {
      const response = await del(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(connections.disconnect).not.toHaveBeenCalled()
  })
})
