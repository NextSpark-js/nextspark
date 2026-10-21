import type { ComponentType } from 'react'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'
import type { FieldDefinition } from '../../../types/blocks'
import type { BlockPickerProps } from './block-picker'
import type { ConfigPanelProps } from './config-panel'
import type { TreeViewProps } from './tree-view'

/**
 * Extension points of the block editor: renderers per field type and replaceable panels.
 *
 * A project supplies them from the theme configuration (`components.builder`) or, for field
 * renderers, with `registerFieldRenderer`. Without any of them the editor renders its own components.
 */

// ── Field renderers ──────────────────────────────────────────────────────────

export interface FieldRendererProps {
  /** The field being edited (the item field when `context` is `'array-item'`). */
  field: FieldDefinition
  /** Current value, with the field's default applied like the built-in renderers do. */
  value: unknown
  /** Stores a new value for the field. */
  onChange: (value: unknown) => void
  /** `'form'` for a field of the settings form, `'array-item'` for a field inside an array item. */
  context: 'form' | 'array-item'
  /** Form fields inside a collapsible group are rendered compact. Always false for array items. */
  compact: boolean
  /** The array field and the item index, when `context` is `'array-item'`. */
  parent?: { field: FieldDefinition; index: number }
  /** The `data-cy` value the built-in renderer would put on its control. */
  dataCy: string
}

export type FieldRenderer = ComponentType<FieldRendererProps>

const fieldRenderers = new Map<string, FieldRenderer>()

/**
 * Registers the renderer for a field type, for a new type or to replace a built-in one.
 * Returns a function that removes it (only if it is still the registered one).
 */
export function registerFieldRenderer(type: string, renderer: FieldRenderer): () => void {
  fieldRenderers.set(type, renderer)
  return () => {
    if (fieldRenderers.get(type) === renderer) fieldRenderers.delete(type)
  }
}

/** The project's renderer for a type, or undefined to use the built-in one. */
export function resolveFieldRenderer(type: string): FieldRenderer | undefined {
  return fieldRenderers.get(type) ?? themeBuilderConfig()?.fieldRenderers?.[type]
}

// ── Replaceable panels ───────────────────────────────────────────────────────

export interface EditorComponents {
  TreeView?: ComponentType<TreeViewProps>
  /** Receives the `TreeView` override as its `TreeView` prop. */
  BlockPicker?: ComponentType<BlockPickerProps>
  ConfigPanel?: ComponentType<ConfigPanelProps>
}

interface ThemeBuilderConfig extends EditorComponents {
  fieldRenderers?: Record<string, FieldRenderer>
}

// The client registry holds the project's own ThemeConfig (a root-first project has exactly one)
function themeBuilderConfig(): ThemeBuilderConfig | undefined {
  return Object.values(THEME_REGISTRY)[0]?.components?.builder
}

/** The panel overrides: the `components` prop first, then the theme configuration. */
export function resolveEditorComponents(components?: EditorComponents): EditorComponents {
  const theme = themeBuilderConfig()
  return {
    TreeView: components?.TreeView ?? theme?.TreeView,
    BlockPicker: components?.BlockPicker ?? theme?.BlockPicker,
    ConfigPanel: components?.ConfigPanel ?? theme?.ConfigPanel,
  }
}
