/**
 * @jest-environment jsdom
 */

// #339: the editor's TreeView, BlockPicker and ConfigPanel can be replaced with the `components` prop or
// from the theme configuration. Without overrides it renders its own panels.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BuilderEditorView } from '@/core/components/dashboard/block-editor/builder-editor-view'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'

jest.mock('uuid', () => ({ v4: () => 'uuid' }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false }) }))
jest.mock('@/core/lib/services/block.service', () => ({ BlockService: { getForScope: () => [] } }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path.split('.').pop() }))
// The built-in panels are stand-ins that show they were rendered (and with which TreeView)
jest.mock('@/core/components/dashboard/block-editor/block-picker', () => ({
  BlockPicker: ({ TreeView }: { TreeView?: unknown }) => <div data-testid="default-picker" data-tree={String(Boolean(TreeView))} />,
}))
jest.mock('@/core/components/dashboard/block-editor/config-panel', () => ({
  ConfigPanel: () => <div data-testid="default-config" />,
}))
jest.mock('@/core/components/dashboard/block-editor/block-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-preview-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/batch-action-bar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/page-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/entity-fields-sidebar', () => new Proxy({}, { get: () => () => null }))

const entityConfig = { name: 'pages', apiPath: 'pages', displayName: 'Pages', features: { enabled: true }, access: { basePath: '/' }, builder: { enabled: true } }
const themeComponents = () => THEME_REGISTRY.default.components as Record<string, unknown>

function renderBuilder(components?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode="create" components={components as never} />
    </QueryClientProvider>
  )
}

beforeEach(() => { global.fetch = jest.fn<typeof fetch>() })
afterEach(() => { delete themeComponents().builder })

describe('editor panels', () => {
  test('without overrides the built-in picker and config panel render, and the picker gets no TreeView', () => {
    renderBuilder()
    expect(screen.getByTestId('default-picker')).toHaveAttribute('data-tree', 'false')
    expect(screen.getByTestId('default-config')).toBeInTheDocument()
  })

  test('ConfigPanel can be replaced and receives its documented props', () => {
    const Config = jest.fn((props: Record<string, unknown>) => <div data-testid="custom-config" data-keys={Object.keys(props).sort().join(',')} />)
    renderBuilder({ ConfigPanel: Config })
    expect(screen.queryByTestId('default-config')).not.toBeInTheDocument()
    expect(screen.getByTestId('custom-config')).toHaveAttribute(
      'data-keys',
      'entityConfig,entityFields,onEntityFieldChange,onPageSettingsChange,pageSettings'
    )
    expect(Config.mock.calls[0][0]).toMatchObject({ entityConfig, entityFields: {}, pageSettings: { seo: {}, customFields: [] } })
  })

  test('BlockPicker can be replaced, receives its props, and gets the TreeView override', () => {
    const Tree = () => null
    const Picker = jest.fn((props: Record<string, unknown>) => <div data-testid="custom-picker" data-has-tree={String(props.TreeView === Tree)} />)
    renderBuilder({ BlockPicker: Picker, TreeView: Tree })
    expect(screen.queryByTestId('default-picker')).not.toBeInTheDocument()
    expect(screen.getByTestId('custom-picker')).toHaveAttribute('data-has-tree', 'true')
    const props = Picker.mock.calls[0][0]
    expect(Object.keys(props)).toEqual(expect.arrayContaining([
      'blocks', 'onAddBlock', 'entityConfig', 'entityFields', 'onEntityFieldChange', 'showFieldsTab',
      'pageBlocks', 'selectedBlockId', 'selectedBlockIds', 'onSelectBlock', 'onReorderBlocks',
      'onCopyBlock', 'onDuplicateBlock', 'onRemoveBlock', 'onPasteBlock', 'clipboardCount',
    ]))
    expect(props.pageBlocks).toEqual([])
  })

  test('TreeView alone reaches the built-in BlockPicker', () => {
    renderBuilder({ TreeView: () => null })
    expect(screen.getByTestId('default-picker')).toHaveAttribute('data-tree', 'true')
  })
})

describe('editor panels from the theme configuration', () => {
  test('the three components are taken from components.builder', async () => {
    const Tree = () => null
    themeComponents().builder = {
      TreeView: Tree,
      BlockPicker: ({ TreeView }: { TreeView?: unknown }) => <div data-testid="theme-picker" data-has-tree={String(TreeView === Tree)} />,
      ConfigPanel: () => <div data-testid="theme-config" />,
    }
    renderBuilder()
    await waitFor(() => expect(screen.getByTestId('theme-picker')).toHaveAttribute('data-has-tree', 'true'))
    expect(screen.getByTestId('theme-config')).toBeInTheDocument()
    expect(screen.queryByTestId('default-picker')).not.toBeInTheDocument()
  })

  test('the prop wins over the theme, and the theme fills what the prop leaves out', () => {
    themeComponents().builder = {
      ConfigPanel: () => <div data-testid="theme-config" />,
      BlockPicker: () => <div data-testid="theme-picker" />,
    }
    renderBuilder({ ConfigPanel: () => <div data-testid="prop-config" /> })
    expect(screen.getByTestId('prop-config')).toBeInTheDocument()
    expect(screen.queryByTestId('theme-config')).not.toBeInTheDocument()
    expect(screen.getByTestId('theme-picker')).toBeInTheDocument()
  })
})
