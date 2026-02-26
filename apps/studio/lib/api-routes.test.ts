/**
 * API Route Tests
 *
 * Tests the API route handlers by importing them directly and
 * mocking their dependencies (auth, db, filesystem).
 *
 * We test:
 * - Input validation (missing params → 400)
 * - Auth enforcement (unauthenticated → 401)
 * - Resource existence checks (not found → 404)
 * - Response shape and status codes
 */

// ── Mocks must be set up BEFORE imports ──

// Mock auth-helpers
const mockRequireSession = jest.fn()
jest.mock('@/lib/auth-helpers', () => ({
  requireSession: () => mockRequireSession(),
}))

// Mock db
const mockQuery = jest.fn()
const mockQueryOne = jest.fn()
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

// Mock migrate
jest.mock('@/lib/migrate', () => ({
  runMigrations: jest.fn().mockResolvedValue(undefined),
}))

// Mock project-manager
const mockExistsSync = jest.fn()
jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: jest.fn().mockReturnValue(''),
}))

jest.mock('@/lib/project-manager', () => ({
  getProjectPath: (slug: string) => `/projects/${slug}`,
  getProjectsRoot: () => '/projects',
  listProjectFiles: jest.fn().mockResolvedValue([
    { name: 'package.json', path: 'package.json', type: 'file' },
    { name: 'app', path: 'app', type: 'directory', children: [] },
  ]),
  readProjectFile: jest.fn().mockResolvedValue('// file content'),
  startPreview: jest.fn().mockResolvedValue(5500),
  stopPreview: jest.fn(),
  setupProjectDatabase: jest.fn().mockResolvedValue({ ok: true }),
}))

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(new Headers()),
}))

// ── Helpers ──

function mockRequest(url: string, options?: RequestInit): Request {
  return new Request(`http://localhost:4000${url}`, options)
}

function authenticated() {
  mockRequireSession.mockResolvedValue({
    user: { id: 'u1', email: 'test@test.com', name: 'Test', role: 'admin' },
    session: { id: 's1', token: 'tok', expiresAt: new Date() },
  })
}

function unauthenticated() {
  mockRequireSession.mockRejectedValue(
    Response.json({ error: 'Unauthorized' }, { status: 401 })
  )
}

// ── Tests ──

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authenticated() // Default: authenticated
    mockExistsSync.mockReturnValue(true) // Default: project exists
  })

  // ────────────────────────────────────
  // GET /api/sessions
  // ────────────────────────────────────
  describe('GET /api/sessions', () => {
    let GET: (request: Request) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/sessions/route')
      GET = mod.GET
    })

    it('returns 401 when unauthenticated', async () => {
      unauthenticated()
      const res = await GET(mockRequest('/api/sessions'))
      expect(res.status).toBe(401)
    })

    it('returns sessions list', async () => {
      const sessions = [
        { id: '1', prompt: 'Test', status: 'done', project_slug: 'test' },
      ]
      mockQuery.mockResolvedValue(sessions)

      const res = await GET(mockRequest('/api/sessions'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.sessions).toEqual(sessions)
    })

    it('respects limit and offset params', async () => {
      mockQuery.mockResolvedValue([])

      await GET(mockRequest('/api/sessions?limit=10&offset=5'))

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10, 5]
      )
    })

    it('caps limit at 100', async () => {
      mockQuery.mockResolvedValue([])

      await GET(mockRequest('/api/sessions?limit=999'))

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [100, 0]
      )
    })
  })

  // ────────────────────────────────────
  // POST /api/sessions
  // ────────────────────────────────────
  describe('POST /api/sessions', () => {
    let POST: (request: Request) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/sessions/route')
      POST = mod.POST
    })

    it('returns 400 when id is missing', async () => {
      const res = await POST(mockRequest('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when prompt is missing', async () => {
      const res = await POST(mockRequest('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123' }),
      }))
      expect(res.status).toBe(400)
    })

    it('creates a new session (201)', async () => {
      const session = { id: 'abc', prompt: 'Create CRM', status: 'loading' }
      mockQueryOne.mockResolvedValue(session)

      const res = await POST(mockRequest('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'abc', prompt: 'Create CRM' }),
      }))

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.session.id).toBe('abc')
    })

    it('returns existing session on conflict', async () => {
      const existing = { id: 'abc', prompt: 'Create CRM', status: 'done' }
      mockQueryOne
        .mockResolvedValueOnce(null) // INSERT returned nothing (conflict)
        .mockResolvedValueOnce(existing) // SELECT existing

      const res = await POST(mockRequest('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'abc', prompt: 'Create CRM' }),
      }))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session.status).toBe('done')
    })
  })

  // ────────────────────────────────────
  // GET /api/sessions/:id
  // ────────────────────────────────────
  describe('GET /api/sessions/:id', () => {
    let GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/sessions/[id]/route')
      GET = mod.GET
    })

    it('returns 404 when session not found', async () => {
      mockQueryOne.mockResolvedValue(null)

      const res = await GET(
        mockRequest('/api/sessions/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      )
      expect(res.status).toBe(404)
    })

    it('returns session data', async () => {
      const session = { id: 'abc', prompt: 'Test', status: 'done' }
      mockQueryOne.mockResolvedValue(session)

      const res = await GET(
        mockRequest('/api/sessions/abc'),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session.id).toBe('abc')
    })
  })

  // ────────────────────────────────────
  // PATCH /api/sessions/:id
  // ────────────────────────────────────
  describe('PATCH /api/sessions/:id', () => {
    let PATCH: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/sessions/[id]/route')
      PATCH = mod.PATCH
    })

    it('returns 400 when no fields to update', async () => {
      const res = await PATCH(
        mockRequest('/api/sessions/abc', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foo: 'bar' }), // invalid field
        }),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      expect(res.status).toBe(400)
    })

    it('updates session status', async () => {
      const updated = { id: 'abc', status: 'done' }
      mockQueryOne.mockResolvedValue(updated)

      const res = await PATCH(
        mockRequest('/api/sessions/abc', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        }),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session.status).toBe('done')
    })

    it('returns 404 when session not found for update', async () => {
      mockQueryOne.mockResolvedValue(null)

      const res = await PATCH(
        mockRequest('/api/sessions/missing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error' }),
        }),
        { params: Promise.resolve({ id: 'missing' }) }
      )
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────
  // DELETE /api/sessions/:id
  // ────────────────────────────────────
  describe('DELETE /api/sessions/:id', () => {
    let DELETE: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/sessions/[id]/route')
      DELETE = mod.DELETE
    })

    it('deletes session and returns ok', async () => {
      mockQuery.mockResolvedValue([])

      const res = await DELETE(
        mockRequest('/api/sessions/abc', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  // ────────────────────────────────────
  // GET /api/files
  // ────────────────────────────────────
  describe('GET /api/files', () => {
    let GET: (request: Request) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/files/route')
      GET = mod.GET
    })

    it('returns 400 when slug missing', async () => {
      const res = await GET(mockRequest('/api/files'))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await GET(mockRequest('/api/files?slug=nonexistent'))
      expect(res.status).toBe(404)
    })

    it('returns file tree', async () => {
      const res = await GET(mockRequest('/api/files?slug=my-app'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.files).toBeDefined()
      expect(Array.isArray(data.files)).toBe(true)
    })
  })

  // ────────────────────────────────────
  // GET /api/file
  // ────────────────────────────────────
  describe('GET /api/file', () => {
    let GET: (request: Request) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/file/route')
      GET = mod.GET
    })

    it('returns 400 when slug missing', async () => {
      const res = await GET(mockRequest('/api/file?path=app/page.tsx'))
      expect(res.status).toBe(400)
    })

    it('returns 400 when path missing', async () => {
      const res = await GET(mockRequest('/api/file?slug=my-app'))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await GET(mockRequest('/api/file?slug=nope&path=app/page.tsx'))
      expect(res.status).toBe(404)
    })

    it('returns file content', async () => {
      const res = await GET(mockRequest('/api/file?slug=my-app&path=app/page.tsx'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.content).toBe('// file content')
      expect(data.path).toBe('app/page.tsx')
    })
  })

  // ────────────────────────────────────
  // POST /api/preview
  // ────────────────────────────────────
  describe('POST /api/preview', () => {
    let POST: (request: Request) => Promise<Response>

    beforeAll(async () => {
      const mod = await import('@/app/api/preview/route')
      POST = mod.POST
    })

    it('returns 400 when action missing', async () => {
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test' }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when slug missing', async () => {
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', slug: 'nope' }),
      }))
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid action', async () => {
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid', slug: 'test' }),
      }))
      expect(res.status).toBe(400)
    })

    it('starts preview and returns port + url', async () => {
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', slug: 'test' }),
      }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.port).toBe(5500)
      expect(data.url).toContain('5500')
    })

    it('stops preview', async () => {
      const res = await POST(mockRequest('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', slug: 'test' }),
      }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  // ────────────────────────────────────
  // POST /api/deploy
  // ────────────────────────────────────
  describe('POST /api/deploy', () => {
    let routeModule: { POST: (request: Request) => Promise<Response>; GET: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response> }

    beforeAll(async () => {
      // Mock deploy-manager before importing
      jest.mock('@/lib/deploy-manager', () => ({
        DeployManager: {
          deploy: jest.fn().mockResolvedValue({ url: 'http://localhost:6000', port: 6000 }),
          getStatus: jest.fn().mockResolvedValue({ slug: 'test', status: 'deployed', port: 6000 }),
          teardown: jest.fn().mockResolvedValue(undefined),
        },
      }))
      routeModule = await import('@/app/api/deploy/route')
    })

    it('returns 400 when slug missing (POST)', async () => {
      const res = await routeModule.POST(mockRequest('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found (POST)', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await routeModule.POST(mockRequest('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'nope' }),
      }))
      expect(res.status).toBe(404)
    })

    it('returns deployment status (GET)', async () => {
      const res = await routeModule.GET(mockRequest('/api/deploy?slug=test'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('deployed')
    })

    it('returns 400 when slug missing (GET)', async () => {
      const res = await routeModule.GET(mockRequest('/api/deploy'))
      expect(res.status).toBe(400)
    })

    it('returns 400 when slug missing (DELETE)', async () => {
      const res = await routeModule.DELETE(mockRequest('/api/deploy', { method: 'DELETE' }))
      expect(res.status).toBe(400)
    })

    it('tears down deployment (DELETE)', async () => {
      const res = await routeModule.DELETE(mockRequest('/api/deploy?slug=test', { method: 'DELETE' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  // ────────────────────────────────────
  // POST /api/entities
  // ────────────────────────────────────
  describe('POST /api/entities', () => {
    let POST: (request: Request) => Promise<Response>

    beforeAll(async () => {
      jest.mock('fs/promises', () => ({
        writeFile: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
      }))
      jest.mock('child_process', () => ({
        execSync: jest.fn(),
      }))
      jest.mock('@/lib/entity-file-generator', () => ({
        generateEntityConfig: jest.fn().mockReturnValue('// config'),
        generateEntityFields: jest.fn().mockReturnValue('// fields'),
        generateMigrationSql: jest.fn().mockReturnValue('-- sql'),
        generateMessages: jest.fn().mockReturnValue('{}'),
      }))
      const mod = await import('@/app/api/entities/route')
      POST = mod.POST
    })

    it('returns 400 when slug missing', async () => {
      const res = await POST(mockRequest('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities: [] }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when entities missing', async () => {
      const res = await POST(mockRequest('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test' }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await POST(mockRequest('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'nope', entities: [] }),
      }))
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────
  // POST /api/pages
  // ────────────────────────────────────
  describe('POST /api/pages', () => {
    let POST: (request: Request) => Promise<Response>

    beforeAll(async () => {
      jest.mock('@/lib/page-template-generator', () => ({
        generatePageTemplate: jest.fn().mockReturnValue('// template'),
        getTemplateFilePath: jest.fn().mockReturnValue('app/(templates)/page.tsx'),
      }))
      const mod = await import('@/app/api/pages/route')
      POST = mod.POST
    })

    it('returns 400 when slug missing', async () => {
      const res = await POST(mockRequest('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: [] }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when pages missing', async () => {
      const res = await POST(mockRequest('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test' }),
      }))
      expect(res.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockExistsSync.mockReturnValue(false)
      const res = await POST(mockRequest('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'nope', pages: [] }),
      }))
      expect(res.status).toBe(404)
    })
  })
})
