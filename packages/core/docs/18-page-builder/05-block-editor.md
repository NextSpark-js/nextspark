# Block Editor Components

> **Experimental:** The page builder dashboard editor is not part of the stable 1.0 surface and may change without a deprecation period. It becomes stable once it has an end-to-end test. Block structure and public rendering are stable. See [Stability](../22-stability-and-support/01-stability.md).

This document describes the components that make up the visual page editor. Understanding these components helps you customize or extend the editor.

## Editor Overview

The page editor has a 3-panel layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           TOP BAR                                     │
│  [← Back]  [Toggle Blocks]  Title Input  Slug Input  [Layout|Preview] │
│                                          [Unsaved]   [Save] [Publish] │
├──────────────┬─────────────────────────────┬─────────────────────────┤
│              │                             │                          │
│  BLOCK       │       CANVAS                │    SETTINGS              │
│  PICKER      │                             │    PANEL                 │
│              │   Layout Mode:              │                          │
│  - Search    │   - Sortable blocks         │  [Content] [Design]      │
│  - Categories│   - Drag handles            │  [Advanced]              │
│  - Block List│                             │                          │
│              │   Preview Mode:             │  DynamicForm             │
│              │   - Live rendering          │  - Text inputs           │
│              │   - Click to select         │  - Rich text             │
│              │                             │  - Arrays                │
│              │                             │  - Selects               │
│              │                             │                          │
└──────────────┴─────────────────────────────┴─────────────────────────┘
```

## Component Hierarchy

```text
PageEditor (page.tsx)
├── TopBar
│   ├── BackButton
│   ├── BlockPickerToggle
│   ├── TitleInput
│   ├── SlugInput
│   ├── ViewModeToggle (Layout/Preview)
│   └── SaveButton, PublishButton
│
├── BlockPicker (left panel)
│   ├── SearchInput
│   ├── CategoryFilter
│   └── BlockList
│
├── Canvas (center)
│   ├── BlockCanvas (layout mode)
│   │   └── SortableBlock (per block)
│   │
│   └── BlockPreviewCanvas (preview mode)
│       └── SelectableBlockPreview (per block)
│
├── BlockSettingsPanel (right panel)
│   ├── BlockHeader
│   ├── Tabs (Content/Design/Advanced)
│   └── DynamicForm
│       └── ArrayField (for repeaters)
│
└── PageSettingsPanel
    └── SEO Fields
```

## Component Details

### BlockPicker

**Location**: `core/components/dashboard/block-editor/block-picker.tsx`

The left panel for selecting blocks to add to the page.

```typescript
interface BlockPickerProps {
  blocks: BlockConfig[]      // Available blocks from registry
  onAddBlock: (slug: string) => void  // Callback when block is selected
}
```

**Features**:
- **Search**: Filter blocks by name or description
- **Categories**: Filter by block category
- **Drag Support**: Blocks can be dragged to canvas
- **Click to Add**: Click a block to append it

**Usage**:
```tsx
<BlockPicker
  blocks={getAllBlocks()}
  onAddBlock={(slug) => handleAddBlock(slug)}
/>
```

### BlockCanvas (Layout Mode)

**Location**: `core/components/dashboard/block-editor/block-canvas.tsx`

The center panel in layout mode showing blocks as sortable items.

```typescript
interface BlockCanvasProps {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onReorder: (blocks: BlockInstance[]) => void
  onUpdateProps: (blockId: string, props: Record<string, unknown>) => void
  onAddBlock: (blockSlug: string) => void
}
```

**Features**:
- **Drag & Drop**: Uses `@dnd-kit/core` for reordering
- **Block Selection**: Click to select for editing
- **Block Actions**: Remove, duplicate buttons
- **Drop Zone**: Accepts blocks dragged from picker

**Key Implementation**:
```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
    {blocks.map((block) => (
      <SortableBlock
        key={block.id}
        block={block}
        isSelected={selectedBlockId === block.id}
        onSelect={() => onSelectBlock(block.id)}
        onRemove={() => onRemoveBlock(block.id)}
        onDuplicate={() => onDuplicateBlock(block.id)}
      />
    ))}
  </SortableContext>
</DndContext>
```

### SortableBlock

**Location**: `core/components/dashboard/block-editor/sortable-block.tsx`

A draggable block wrapper for layout mode.

```typescript
interface SortableBlockProps {
  block: BlockInstance
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onDuplicate: () => void
}
```

**Features**:
- **Drag Handle**: Grip icon for dragging
- **Selection State**: Visual indicator when selected
- **Action Buttons**: Duplicate, remove
- **Block Preview**: Shows block name and type

### BlockPreviewCanvas (Preview Mode)

**Location**: `core/components/dashboard/block-editor/block-preview-canvas.tsx`

The center panel in preview mode showing actual rendered blocks.

```typescript
interface BlockPreviewCanvasProps {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}
```

**Features**:
- **Live Rendering**: Shows actual block components
- **Click to Select**: Click any block to edit it
- **Reorder Controls**: Up/down buttons on hover
- **Selection Ring**: Visual indicator for selected block

**Key Implementation**:
```tsx
function SelectableBlockPreview({ block, isSelected, onSelect }) {
  const BlockComponent = BLOCK_COMPONENTS[block.blockSlug]
  const normalizedProps = normalizeBlockProps(block.props)

  return (
    <div
      className={cn(
        'relative cursor-pointer',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      <Suspense fallback={<BlockSkeleton />}>
        <div className="pointer-events-none">
          <BlockComponent {...normalizedProps} />
        </div>
      </Suspense>
    </div>
  )
}
```

### BlockSettingsPanel

**Location**: `core/components/dashboard/block-editor/block-settings-panel.tsx`

The right panel for configuring the selected block.

```typescript
interface BlockSettingsPanelProps {
  block: BlockInstance | undefined
  onUpdateProps: (props: Record<string, unknown>) => void
  onRemove: () => void
}
```

**Features**:
- **3-Tab Structure**: Content, Design, Advanced tabs
- **Block Header**: Name, description, category badge
- **Reset Button**: Reset all props to defaults
- **Remove Button**: Delete block from page

**Tab Organization**:
```tsx
<Tabs defaultValue="content">
  <TabsList>
    <TabsTrigger value="content">Content</TabsTrigger>
    <TabsTrigger value="design">Design</TabsTrigger>
    <TabsTrigger value="advanced">Advanced</TabsTrigger>
  </TabsList>

  <TabsContent value="content">
    <DynamicForm
      fieldDefinitions={groupedFields.content}
      values={block.props}
      onChange={onUpdateProps}
    />
  </TabsContent>
  {/* ... other tabs */}
</Tabs>
```

### DynamicForm

**Location**: `core/components/dashboard/block-editor/dynamic-form.tsx`

Auto-generates form fields from field definitions.

```typescript
interface DynamicFormProps {
  fieldDefinitions: FieldDefinition[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}
```

**Features**:
- **Auto-Generation**: Creates inputs from field definitions
- **Field Groups**: Collapsible groups for related fields
- **Debounced Updates**: 500ms debounce on changes
- **Validation**: Required field indicators

**Supported Field Types**:
| Type | Component |
|------|-----------|
| `text` | Input |
| `textarea` | Textarea |
| `rich-text` | RichTextEditor |
| `url` | Input[type=url] |
| `number` | Input[type=number] |
| `select` | Select dropdown |
| `image` | ImageUpload |
| `array` | ArrayField |

**Field Rendering**:
```tsx
const renderField = (field: FieldDefinition) => {
  switch (field.type) {
    case 'text':
      return <Input value={value} onChange={handleChange} />
    case 'select':
      return (
        <Select value={value} onValueChange={handleChange}>
          {field.options?.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </Select>
      )
    case 'array':
      return <ArrayField field={field} value={value} onChange={handleChange} />
    // ... other types
  }
}
```

### ArrayField

**Location**: `core/components/dashboard/block-editor/array-field.tsx`

Handles repeater/array fields like features lists.

```typescript
interface ArrayFieldProps {
  field: FieldDefinition
  value: unknown[]
  onChange: (value: unknown[]) => void
}
```

**Features**:
- **Add Items**: Button to add new items
- **Remove Items**: Delete individual items
- **Reorder**: Move items up/down
- **Min/Max Limits**: Enforce item count constraints
- **Nested Fields**: Each item has its own fields

**Usage in Field Definitions**:
```typescript
{
  name: 'features',
  type: 'array',
  minItems: 1,
  maxItems: 12,
  itemFields: [
    { name: 'icon', type: 'text', label: 'Icon' },
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'description', type: 'textarea', label: 'Description' },
  ],
}
```

### PageSettingsPanel

**Location**: `core/components/dashboard/block-editor/page-settings-panel.tsx`

SEO and page-level settings.

```typescript
interface PageSettingsPanelProps {
  settings: PageSettings
  onChange: (settings: PageSettings) => void
}
```

**Fields**:
- SEO Title
- SEO Description
- SEO Keywords
- Open Graph Image
- Custom Fields

## State Management

The PageEditor component manages all state:

```typescript
// Page Editor State
const [blocks, setBlocks] = useState<BlockInstance[]>([])
const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
const [title, setTitle] = useState('')
const [slug, setSlug] = useState('')
const [published, setPublished] = useState(false)
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
const [viewMode, setViewMode] = useState<ViewMode>('preview')
const [showBlockPicker, setShowBlockPicker] = useState(true)
const [pageSettings, setPageSettings] = useState<PageSettings>({...})
```

### Block Operations

```typescript
// Add block
const handleAddBlock = (blockSlug: string) => {
  const newBlock: BlockInstance = {
    id: uuidv4(),
    blockSlug,
    props: {}
  }
  setBlocks(prev => [...prev, newBlock])
  setSelectedBlockId(newBlock.id)
}

// Update block props
const handleUpdateBlockProps = (blockId: string, props: Record<string, unknown>) => {
  setBlocks(prev => prev.map(block =>
    block.id === blockId ? { ...block, props } : block
  ))
}

// Remove block
const handleRemoveBlock = (blockId: string) => {
  setBlocks(prev => prev.filter(b => b.id !== blockId))
  if (selectedBlockId === blockId) {
    setSelectedBlockId(null)
  }
}

// Reorder blocks
const handleReorderBlocks = (newBlocks: BlockInstance[]) => {
  setBlocks(newBlocks)
}
```

## Customization

### Adding Custom Field Types

`DynamicForm` and the items of an `ArrayField` ask a registry of renderers, keyed by field type, before their built-in `switch`. A project can add a renderer for a new type or replace the one of a built-in type without changing core. With nothing registered the form renders exactly as before.

A renderer is a React component that receives `FieldRendererProps`:

| Prop | Meaning |
|------|---------|
| `field` | The `FieldDefinition` being edited (the item field inside an array) |
| `value` | The current value, with the field's `default` applied |
| `onChange(value)` | Stores a new value for the field |
| `context` | `'form'` for a field of the settings form, `'array-item'` for a field inside an array item |
| `compact` | `true` for a form field inside a collapsible group |
| `parent` | `{ field, index }` of the array field and item, when `context` is `'array-item'` |
| `dataCy` | The `data-cy` value the built-in renderer would use |

The label, required marker and help text are drawn around the renderer, as for the built-in types.

Register renderers from the theme configuration (`theme.config.ts`), which the editor reads on the client:

```tsx
import type { ThemeConfig } from '@nextsparkjs/core/types/theme'
import { RatingField } from './components/builder/rating-field'
import { PlainTextField } from './components/builder/plain-text-field'

export const myThemeConfig: ThemeConfig = {
  name: 'my-theme',
  displayName: 'My Theme',
  version: '1.0.0',
  components: {
    builder: {
      fieldRenderers: {
        rating: RatingField,        // a new type: { name: 'stars', type: 'rating', ... }
        text: PlainTextField,       // replaces the built-in `text` renderer
      },
    },
  },
}
```

```tsx
// components/builder/rating-field.tsx: the module theme.config.ts imports. Keep it small.
'use client'
import dynamic from 'next/dynamic'

// the real component, and whatever UI it pulls in, loads only when the editor shows a `rating` field
export const RatingField = dynamic(() => import('./rating-field-impl'))
```

```tsx
// components/builder/rating-field-impl.tsx
'use client'
import type { FieldRendererProps } from '@nextsparkjs/core/components/dashboard/block-editor/editor-extensions'

export default function RatingFieldImpl({ value, onChange, dataCy }: FieldRendererProps) {
  return (
    <input type="number" min={1} max={5} value={Number(value) || 1} data-cy={dataCy}
      onChange={(e) => onChange(Number(e.target.value))} />
  )
}
```

**Keep what `theme.config.ts` imports light.** The theme configuration is also loaded by the server registry and reaches the bundle of the proxy, so a static import of a renderer, and of every UI library it imports, ends up there too. Import only a thin wrapper (as above, with `next/dynamic`, or a small component that has no heavy dependencies) and put the real component behind a dynamic import. The same applies to the panels of `components.builder` below.

Code that runs on the client before the editor renders can also call `registerFieldRenderer(type, Renderer)` from the same module. It returns a function that removes the renderer again, and it wins over a renderer of the theme configuration for the same type. A field type outside the built-in list is valid in a `FieldDefinition` (`type: 'rating'`); without a renderer it falls back to a text input. The built-in renderers stay in the `switch` of `dynamic-form.tsx` and `array-field.tsx`: they are the defaults used when no renderer is registered for the type.

### Replacing Editor Panels

The editor renders its `TreeView` (inside the block picker), `BlockPicker` and `ConfigPanel` unless you give it other components. Pass them with the `components` prop of `BuilderEditorView`, or set them once for the project in `theme.config.ts` as `components.builder`; the prop wins over the theme for the same panel. `theme.config.ts` is the normal way for a project: the `components` prop only works from a client component (a server component cannot pass functions as props).

```tsx
export const myThemeConfig: ThemeConfig = {
  // ...
  components: {
    builder: {
      TreeView: MyTree,          // receives the TreeView props
      BlockPicker: MyPicker,     // receives the BlockPicker props, including `TreeView`
      ConfigPanel: MyConfigPanel // receives the ConfigPanel props
    },
  },
}
```

```tsx
<BuilderEditorView
  entitySlug="pages"
  entityConfig={entityConfig}
  mode="edit"
  id={id}
  components={{ TreeView: MyTree }}
/>
```

Each replacement receives the props of the component it replaces (`TreeViewProps`, `BlockPickerProps`, `ConfigPanelProps`, exported from `tree-view`, `block-picker` and `config-panel` in the same folder). The built-in `BlockPicker` renders the `TreeView` override in its Layout tab; a replacement `BlockPicker` receives it as its `TreeView` prop and decides what to do with it. Panels that are not replaced stay as they are.

### Before-save and Before-publish Hooks

A project can check or adjust a page before the editor sends it. `onBeforeSave` runs before every save (Save draft, Update and Publish) and `onBeforePublish` runs right after it when the status being saved is `published` (Publish, and Update of an already published page). Set them with the `hooks` prop of `BuilderEditorView` or once for the project in `theme.config.ts` under `components.builder` (the prop wins over the theme for the same hook):

```tsx
// theme.config.ts
export const myThemeConfig: ThemeConfig = {
  // ...
  components: {
    builder: {
      onBeforePublish: async (payload) => {
        if (!payload.blocks.some((block) => block.blockSlug === 'hero')) {
          return { veto: 'Add a hero block before publishing' } // stops the save, the editor shows the message
        }
        // returning nothing lets the save go on
      },
    },
  },
}
```

A hook receives `(payload, context)`. `payload` is the body the editor sends (`title`, `slug` when it changed, `blocks`, `status`, `settings` and the entity's own fields); `context` is `{ action: 'draft' | 'update' | 'publish', mode, entitySlug, id }`. It may answer:

- nothing, or `true`: the save goes on.
- `{ veto: 'message' }`: nothing is sent and the message is shown as an error. `false` also vetoes, with the generic "The page was not saved".
- `{ data: payload }`: the save goes on with that payload instead (the next hook sees it too). Treat the `payload` you receive as read-only and return a changed copy.

A hook that throws, rejects or returns `data` that is not an object is reported as an error ("The page was not saved: ...") and nothing is sent. While a hook is pending the save buttons are disabled, and they come back when it ends, whatever the outcome; a hook that never settles keeps them disabled, so give a slow check its own timeout. With no hook configured the editor saves exactly as before.

`theme.config.ts` also reaches the bundle of the proxy, so keep the module a hook comes from light: import only what the hook needs, and load anything heavy with a dynamic `import()` inside the hook (as for the field renderers above). The hooks run in the browser, before the request: they are a convenience for the editor's user and can be bypassed by anything that calls the API directly. Rules that must always hold belong in the server-side `beforeUpdate` entity hook (see [Hooks and lifecycle](../04-entities/08-hooks-and-lifecycle.md)), which runs for every write and complements these.

### Styling the Editor

Override styles using CSS variables or Tailwind:

```css
/* Custom editor styles */
[data-cy="page-editor"] {
  --editor-sidebar-width: 320px;
}
```

### Adding Editor Plugins

Create custom panels or toolbar items:

```tsx
// Custom toolbar button
<Button
  variant={isMyFeatureEnabled ? "default" : "ghost"}
  onClick={toggleMyFeature}
>
  <MyIcon className="h-4 w-4" />
</Button>
```

## Data Attributes

Components include data attributes for testing:

| Attribute | Component | Purpose |
|-----------|-----------|---------|
| `data-cy="page-editor"` | PageEditor | Main editor container |
| `data-cy="block-picker"` | BlockPicker | Left panel |
| `data-cy="block-canvas"` | BlockCanvas | Center panel (layout) |
| `data-cy="block-preview-canvas"` | BlockPreviewCanvas | Center panel (preview) |
| `data-cy="block-settings-panel"` | BlockSettingsPanel | Right panel |
| `data-cy="block-item-{slug}"` | BlockPicker item | Individual block in picker |
| `data-cy="field-{name}"` | DynamicForm field | Form input |

## Next Steps

1. **[Creating Blocks](./04-creating-blocks.md)** - Build custom blocks
2. **[Pages API](./06-pages-api.md)** - REST API reference
3. **[User Guide](./08-user-guide.md)** - Using the editor

---

> **Extension Point**: The editor is designed for extensibility. Most components accept callbacks that you can intercept to add custom behavior.

**Last Updated**: 2025-01-21
**Version**: 1.0.0
**Status**: Stable
