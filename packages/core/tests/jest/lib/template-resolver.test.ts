/**
 * Unit Tests - Template Resolver
 *
 * A theme template with no default export is registered with
 * `component: null` (#197), the same as a `.meta.ts` file or a
 * PROTECTED_RENDER path. These tests confirm that resolving such an
 * override falls back to the app's own component instead of rendering
 * `null`, and that its metadata still resolves independently of the
 * missing component.
 *
 * @see {@link /core/lib/template-resolver.ts}
 */

jest.mock('@/core/lib/services/template.service', () => ({
  TemplateService: {
    hasOverride: jest.fn(),
    getComponent: jest.fn(),
    getEntry: jest.fn()
  }
}))

import { TemplateService } from '@/core/lib/services/template.service'
import { getTemplateOrDefault, getMetadataOrDefault } from '@/core/lib/template-resolver'

const mockedTemplateService = TemplateService as jest.Mocked<typeof TemplateService>

describe('getTemplateOrDefault with a metadata-only override', () => {
  const appPath = 'app/(public)/docs/layout.tsx'
  const DefaultLayout = () => null

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('falls back to the app component instead of rendering the missing override component', () => {
    mockedTemplateService.hasOverride.mockReturnValue(true)
    mockedTemplateService.getComponent.mockReturnValue(null)

    const result = getTemplateOrDefault(appPath, DefaultLayout)

    expect(result).toBe(DefaultLayout)
  })

  it('still resolves the override metadata even though it has no component', () => {
    mockedTemplateService.hasOverride.mockReturnValue(true)
    mockedTemplateService.getEntry.mockReturnValue({
      appPath,
      component: null,
      template: {
        name: 'docs/layout',
        themeName: 'testtheme',
        templateType: 'layout',
        fileName: 'layout.tsx',
        relativePath: 'docs/layout.tsx',
        appPath,
        templatePath: '@/templates/docs/layout.tsx',
        priority: 10,
        metadata: { title: 'Docs' }
      },
      alternatives: []
    })

    const result = getMetadataOrDefault(appPath, { title: 'Default' })

    expect(result).toEqual({ title: 'Docs' })
  })
})
