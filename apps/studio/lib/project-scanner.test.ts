import path from 'path'
import { scanProjectState } from './project-scanner'

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}))

import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'

const mockReaddir = readdir as jest.MockedFunction<typeof readdir>
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>

const PROJECT_DIR = '/test/project'
const THEME = 'starter'

function entitiesDir() {
  return path.join(PROJECT_DIR, 'contents', 'themes', THEME, 'entities')
}

function configDir() {
  return path.join(PROJECT_DIR, 'contents', 'themes', THEME, 'config', 'app.config.ts')
}

function pagesConfigPath() {
  return path.join(PROJECT_DIR, 'contents', 'themes', THEME, 'entities', 'pages', 'pages.config.ts')
}

beforeEach(() => {
  jest.resetAllMocks()
  // Default: nothing exists
  mockExistsSync.mockReturnValue(false)
})

// ── scanEntityConfig (via scanProjectState) ────────────────────────────────

describe('entity scanning', () => {
  function setupEntityDir(entityName: string, configContent: string, fieldsContent?: string) {
    // entities dir exists
    mockExistsSync.mockImplementation((p: unknown) => {
      const s = String(p)
      if (s === entitiesDir()) return true
      if (s.endsWith(`${entityName}.config.ts`)) return true
      if (fieldsContent && s.endsWith(`${entityName}.fields.ts`)) return true
      return false
    })

    // readdir returns the entity directory
    mockReaddir.mockResolvedValue([
      { name: entityName, isDirectory: () => true, isFile: () => false } as any,
    ])

    // readFile returns config content
    mockReadFile.mockImplementation(async (filePath: any) => {
      const p = String(filePath)
      if (p.endsWith(`${entityName}.config.ts`)) return configContent
      if (fieldsContent && p.endsWith(`${entityName}.fields.ts`)) return fieldsContent
      throw new Error('File not found')
    })
  }

  it('extracts slug from entity config', async () => {
    setupEntityDir('products', `
      export const productsConfig = {
        slug: 'products',
        names: { singular: 'Product', plural: 'Products' },
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities).toHaveLength(1)
    expect(result.entities![0].slug).toBe('products')
  })

  it('extracts singular and plural names', async () => {
    setupEntityDir('tasks', `
      export const config = {
        slug: 'tasks',
        names: { singular: 'Task', plural: 'Tasks' },
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities![0].names).toEqual({ singular: 'Task', plural: 'Tasks' })
  })

  it('extracts inline fields with name and type', async () => {
    setupEntityDir('products', `
      export const config = {
        slug: 'products',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'price', type: 'currency', required: true },
        ]
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities![0].fields).toEqual([
      { name: 'title', type: 'text' },
      { name: 'price', type: 'currency' },
    ])
  })

  it('falls back to companion .fields.ts file', async () => {
    const configContent = `
      export const config = {
        slug: 'invoices',
        names: { singular: 'Invoice', plural: 'Invoices' },
      }
    `
    const fieldsContent = `
      export const invoicesFields = [
        { name: 'number', type: 'text' },
        { name: 'amount', type: 'currency' },
      ]
    `
    setupEntityDir('invoices', configContent, fieldsContent)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities![0].fields).toEqual([
      { name: 'number', type: 'text' },
      { name: 'amount', type: 'currency' },
    ])
  })

  it('returns null for config without slug (skipped in results)', async () => {
    setupEntityDir('broken', `
      export const config = {
        names: { singular: 'Broken', plural: 'Broken' },
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities).toBeUndefined()
  })

  it('returns empty entities for non-existent entities directory', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities).toBeUndefined()
  })

  it('scans multiple entities from directory', async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      const s = String(p)
      if (s === entitiesDir()) return true
      if (s.endsWith('products.config.ts')) return true
      if (s.endsWith('clients.config.ts')) return true
      return false
    })

    mockReaddir.mockResolvedValue([
      { name: 'products', isDirectory: () => true, isFile: () => false } as any,
      { name: 'clients', isDirectory: () => true, isFile: () => false } as any,
      { name: 'readme.md', isDirectory: () => false, isFile: () => true } as any,
    ])

    mockReadFile.mockImplementation(async (filePath: any) => {
      const p = String(filePath)
      if (p.endsWith('products.config.ts')) return "slug: 'products'"
      if (p.endsWith('clients.config.ts')) return "slug: 'clients'"
      throw new Error('File not found')
    })

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities).toHaveLength(2)
    expect(result.entities!.map(e => e.slug).sort()).toEqual(['clients', 'products'])
  })
})

// ── scanAppConfig (via scanProjectState) ──────────────────────────────────

describe('app config scanning', () => {
  function setupAppConfig(content: string) {
    mockExistsSync.mockImplementation((p: unknown) => {
      return String(p) === configDir()
    })
    mockReadFile.mockResolvedValue(content)
  }

  it('extracts projectName from name property', async () => {
    setupAppConfig(`
      export const appConfig = {
        name: 'My SaaS App',
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig).toBeDefined()
    expect(result.wizardConfig!.projectName).toBe('My SaaS App')
  })

  it('extracts teamMode from mode property', async () => {
    setupAppConfig(`
      teams: {
        mode: 'multi-tenant',
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig!.teamMode).toBe('multi-tenant')
  })

  it('extracts defaultLocale', async () => {
    setupAppConfig(`
      i18n: {
        defaultLocale: 'es',
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig!.defaultLocale).toBe('es')
  })

  it('extracts supportedLocales array', async () => {
    setupAppConfig(`
      i18n: {
        supportedLocales: ['en', 'es', 'fr'],
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig!.supportedLocales).toEqual(['en', 'es', 'fr'])
  })

  it('extracts registration mode from nested object', async () => {
    setupAppConfig(`
      auth: {
        registration: {
          mode: 'invitation-only',
        }
      }
    `)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig!.registrationMode).toBe('invitation-only')
  })

  it('returns undefined for non-existent config file', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.wizardConfig).toBeUndefined()
  })
})

// ── scanPages (via scanProjectState) ──────────────────────────────────────

describe('pages scanning', () => {
  it('returns placeholder when pages entity config exists', async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      return String(p) === pagesConfigPath()
    })

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.pages).toEqual([{ pageName: 'Pages', route: '/' }])
  })

  it('returns no pages when pages entity does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.pages).toBeUndefined()
  })
})

// ── Full scan integration ────────────────────────────────────────────────

describe('full scanProjectState', () => {
  it('returns empty object for completely empty project', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result).toEqual({})
  })

  it('combines entities, pages, and wizardConfig', async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      const s = String(p)
      if (s === entitiesDir()) return true
      if (s.endsWith('products.config.ts')) return true
      if (s === configDir()) return true
      if (s === pagesConfigPath()) return true
      return false
    })

    mockReaddir.mockResolvedValue([
      { name: 'products', isDirectory: () => true, isFile: () => false } as any,
    ])

    mockReadFile.mockImplementation(async (filePath: any) => {
      const p = String(filePath)
      if (p.endsWith('products.config.ts')) return "slug: 'products'"
      if (p.endsWith('app.config.ts')) return "name: 'Test App'"
      throw new Error('not found')
    })

    const result = await scanProjectState(PROJECT_DIR, THEME)
    expect(result.entities).toHaveLength(1)
    expect(result.pages).toHaveLength(1)
    expect(result.wizardConfig).toBeDefined()
    expect(result.wizardConfig!.projectName).toBe('Test App')
  })
})
