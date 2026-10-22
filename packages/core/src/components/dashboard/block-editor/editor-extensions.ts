import type { ComponentType } from 'react'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'
import type { BlockInstance, FieldDefinition } from '../../../types/blocks'
import type { PageSettings } from './page-settings-panel'
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

interface ThemeBuilderConfig extends EditorComponents, EditorHooks {
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

// ── Before-save and before-publish hooks ─────────────────────────────────────

/** The body the editor sends to the API: the fixed keys below plus the entity's own fields (`excerpt`, ...). */
export interface BuilderSavePayload {
  title: string
  /** Absent when the stored slug was not changed. */
  slug?: string
  blocks: BlockInstance[]
  status: string
  settings: PageSettings
  [field: string]: unknown
}

export interface BuilderSaveContext {
  /** `'draft'`: Save draft. `'publish'`: Publish. `'update'`: Update, on a page whose status is already published. */
  action: 'draft' | 'update' | 'publish'
  mode: 'create' | 'edit'
  entitySlug: string
  /** Undefined in create mode. */
  id?: string
}

/**
 * What a hook may answer. Nothing (or `true`) lets the save go on; `{ veto: 'message' }` stops it and shows the
 * message in the editor; `{ data }` lets it go on with that payload instead of the editor's.
 */
export type BuilderHookResult = void | undefined | true | { veto: string } | { data: BuilderSavePayload }

/** Treat `payload` as read-only: return `{ data }` to change what is sent. */
export type BuilderHook = (payload: BuilderSavePayload, context: BuilderSaveContext) => BuilderHookResult | Promise<BuilderHookResult>

export interface EditorHooks {
  /** Runs before every save: Save draft, Update and Publish. */
  onBeforeSave?: BuilderHook
  /** Runs after `onBeforeSave`, only when the payload's `status` is `'published'` (Publish, and Update of a published page). */
  onBeforePublish?: BuilderHook
}

export type BeforeSaveOutcome =
  | { payload: BuilderSavePayload }
  | { veto: string }
  | { error: string }

/** The hooks that apply: the `hooks` prop first, then the theme configuration (`components.builder`). */
export function resolveEditorHooks(hooks?: EditorHooks): EditorHooks {
  const theme = themeBuilderConfig()
  return {
    onBeforeSave: hooks?.onBeforeSave ?? theme?.onBeforeSave,
    onBeforePublish: hooks?.onBeforePublish ?? theme?.onBeforePublish,
  }
}

/**
 * Runs `onBeforeSave` and then, when the payload is being published, `onBeforePublish`. Each sees the payload the
 * previous one returned. A veto stops at once; a hook that throws or rejects, or returns a payload that is not an
 * object, ends as `{ error }` with the reason, so the caller can report it and keep the editor usable.
 */
export async function runBeforeSaveHooks(hooks: EditorHooks, payload: BuilderSavePayload, context: BuilderSaveContext): Promise<BeforeSaveOutcome> {
  let current = payload
  const steps = [['onBeforeSave', () => hooks.onBeforeSave], ['onBeforePublish', () => (current.status === 'published' ? hooks.onBeforePublish : undefined)]] as const
  for (const [name, pick] of steps) {
    const hook = pick()
    if (!hook) continue
    let result: BuilderHookResult
    try {
      result = await hook(current, context)
    } catch (error) {
      return { error: error instanceof Error && error.message ? error.message : String(error) }
    }
    if (result && typeof result === 'object') {
      if ('veto' in result) return { veto: typeof result.veto === 'string' ? result.veto : '' }
      if ('data' in result) {
        if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
          return { error: `${name} returned data that is not an object` }
        }
        current = result.data
      }
    }
  }
  return { payload: current }
}
