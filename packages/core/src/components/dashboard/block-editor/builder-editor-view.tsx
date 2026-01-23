'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '../../ui/button'
import { ButtonGroup } from '../../ui/button-group'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Separator } from '../../ui/separator'
import { Badge } from '../../ui/badge'
import { ArrowLeft, Save, ExternalLink, Eye, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { sel } from '../../../lib/test'
import { BlockPicker } from './block-picker'
import { BlockCanvas } from './block-canvas'
import { BlockPreviewCanvas } from './block-preview-canvas'
import { IframePreview } from './iframe-preview'
import { BlockSettingsPanel } from './block-settings-panel'
import { PageSettingsPanel, type PageSettings } from './page-settings-panel'
import { EntityFieldsSidebar } from './entity-fields-sidebar'
import { StatusSelector, type StatusOption } from './status-selector'
import { BlockService } from '../../../lib/services/block.service'
import { ViewportToggle, type ViewportMode, MOBILE_VIEWPORT_WIDTH } from './viewport-toggle'
import { ConfigPanel } from './config-panel'
import { useSidebar } from '../../../contexts/sidebar-context'
import { cn } from '../../../lib/utils'
import type { BlockInstance } from '../../../types/blocks'
import type { PatternReference } from '../../../types/pattern-reference'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'

type ViewMode = 'preview' | 'settings'

// Helper to get team ID from localStorage
function getTeamId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeTeamId')
  }
  return null
}

// Helper to build headers with team context and builder source identification
function buildApiHeaders(includeContentType = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  const teamId = getTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  // Identify that the request comes from the builder
  headers['x-builder-source'] = 'true'
  return headers
}
type LeftSidebarMode = 'blocks' | 'fields' | 'none'

// Helper to convert title to URL-friendly slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
}

export interface BuilderEditorViewProps {
  entitySlug: string
  entityConfig: ClientEntityConfig
  id?: string  // undefined = create mode
  mode: 'create' | 'edit'
}

export function BuilderEditorView({ entitySlug, entityConfig, id, mode }: BuilderEditorViewProps) {
  const router = useRouter()
  const t = useTranslations('admin.builder')
  const queryClient = useQueryClient()
  const { isCollapsed } = useSidebar()

  const [blocks, setBlocks] = useState<BlockInstance[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [status, setStatus] = useState<string>('draft')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop')
  // Lazy loading: track if mobile has ever been activated (iframe only loads on first use)
  const [hasActivatedMobile, setHasActivatedMobile] = useState(false)

  // Track first mobile activation for lazy loading
  useEffect(() => {
    if (viewportMode === 'mobile' && !hasActivatedMobile) {
      setHasActivatedMobile(true)
    }
  }, [viewportMode, hasActivatedMobile])

  const [leftSidebarMode, setLeftSidebarMode] = useState<LeftSidebarMode>('blocks')
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    seo: {},
    customFields: []
  })
  // Entity-specific fields (excerpt, featuredImage, etc.)
  const [entityFields, setEntityFields] = useState<Record<string, unknown>>({})
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{ title?: boolean; slug?: boolean }>({})
  // Ref for title input auto-focus
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Determine if we should show the Fields option
  const showFieldsOption = useMemo(() => {
    return (
      (entityConfig.builder?.sidebarFields?.length ?? 0) > 0 ||
      entityConfig.taxonomies?.enabled
    )
  }, [entityConfig])

  // Determine if we should show the Patterns tab (hide when editing patterns)
  const showPatternsTab = useMemo(() => {
    return entitySlug !== 'patterns'
  }, [entitySlug])

  // Determine if slug should be visible (default: true)
  const showSlug = useMemo(() => {
    return entityConfig.builder?.showSlug !== false
  }, [entityConfig])

  // Determine if entity is public (for external link visibility)
  // ClientEntityConfig only exposes basePath, so we check if it exists
  const isPublicEntity = useMemo(() => {
    return !!entityConfig.access?.basePath
  }, [entityConfig])

  // Filter blocks by entity scope
  // When editing patterns, BlockService.getForScope automatically filters by allowInPatterns
  const availableBlocks = useMemo(() => {
    return BlockService.getForScope(entitySlug)
  }, [entitySlug])

  // Fetch entity data (only in edit mode)
  const { data: entityData, isLoading } = useQuery({
    queryKey: [entitySlug, id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/${entitySlug}/${id}`, {
        headers: buildApiHeaders(),
      })
      if (!response.ok) throw new Error(`Failed to fetch ${entitySlug}`)
      const data = await response.json()
      return data
    },
    enabled: mode === 'edit' && !!id,
  })

  // Initialize form with entity data (edit mode)
  useEffect(() => {
    if (mode === 'edit' && entityData?.data) {
      const entity = entityData.data
      setTitle(entity.title ?? '')
      setSlug(entity.slug ?? '')
      setSlugManuallyEdited(true) // In edit mode, don't auto-generate slug
      setStatus(entity.status || 'draft')
      setBlocks(entity.blocks || [])
      setPageSettings(entity.settings || { seo: {}, customFields: [] })

      // Set entity-specific fields
      const fields: Record<string, unknown> = {}
      entityConfig.builder?.sidebarFields?.forEach(field => {
        if (entity[field] !== undefined) {
          fields[field] = entity[field]
        }
      })
      setEntityFields(fields)
    }
  }, [entityData, entityConfig, mode])

  // Track unsaved changes (edit mode only)
  useEffect(() => {
    if (mode === 'create') {
      // In create mode, any content is "unsaved"
      setHasUnsavedChanges(title.length > 0 || blocks.length > 0 || status !== 'draft')
      return
    }

    if (!entityData?.data) return
    const entity = entityData.data
    const hasChanges =
      title !== entity.title ||
      slug !== entity.slug ||
      status !== (entity.status || 'draft') ||
      JSON.stringify(blocks) !== JSON.stringify(entity.blocks || []) ||
      JSON.stringify(pageSettings) !== JSON.stringify(entity.settings || { seo: {}, customFields: [] }) ||
      JSON.stringify(entityFields) !== JSON.stringify(
        entityConfig.builder?.sidebarFields?.reduce((acc, field) => {
          if (entity[field] !== undefined) acc[field] = entity[field]
          return acc
        }, {} as Record<string, unknown>) || {}
      )
    setHasUnsavedChanges(hasChanges)
  }, [title, slug, status, blocks, pageSettings, entityFields, entityData, entityConfig, mode])

  // Auto-focus title input in create mode
  useEffect(() => {
    if (mode === 'create' && titleInputRef.current) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        titleInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [mode])

  // Clear validation errors when fields are filled
  useEffect(() => {
    if (title && validationErrors.title) {
      setValidationErrors(prev => ({ ...prev, title: false }))
    }
    if (slug && validationErrors.slug) {
      setValidationErrors(prev => ({ ...prev, slug: false }))
    }
  }, [title, slug, validationErrors.title, validationErrors.slug])

  // Save/Create mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const url = mode === 'create'
        ? `/api/v1/${entitySlug}`
        : `/api/v1/${entitySlug}/${id}`

      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: buildApiHeaders(true),
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to save ${entitySlug}`)
      }

      return response.json()
    },
    onSuccess: (response) => {
      if (mode === 'create') {
        // Navigate to edit mode with new ID
        const newId = response.data?.id
        if (newId) {
          toast.success(t('messages.created'))
          router.push(`/dashboard/${entitySlug}/${newId}/edit`)
        }
      } else {
        queryClient.invalidateQueries({ queryKey: [entitySlug, id] })
        queryClient.invalidateQueries({ queryKey: [entitySlug] })
        toast.success(t('messages.saved'))
        setHasUnsavedChanges(false)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Validate required fields before save
  const validateFields = useCallback((): boolean => {
    const errors: { title?: boolean; slug?: boolean } = {}

    if (!title.trim()) {
      errors.title = true
    }
    // Only validate slug if it's visible/editable
    if (showSlug && !slug.trim()) {
      errors.slug = true
    }

    setValidationErrors(errors)

    if (errors.title || errors.slug) {
      // Focus the first invalid field
      if (errors.title) {
        titleInputRef.current?.focus()
      }
      return false
    }

    return true
  }, [title, slug, showSlug])

  const handleSave = useCallback(() => {
    if (!validateFields()) return

    const data: Record<string, unknown> = {
      title,
      slug,
      blocks,
      status,
      settings: pageSettings,
      ...entityFields,
    }
    saveMutation.mutate(data)
  }, [title, slug, blocks, status, pageSettings, entityFields, saveMutation, validateFields])

  const handleSaveDraft = useCallback(() => {
    if (!validateFields()) return

    const data: Record<string, unknown> = {
      title,
      slug,
      blocks,
      status: 'draft',
      settings: pageSettings,
      ...entityFields,
    }
    saveMutation.mutate(data)
  }, [title, slug, blocks, pageSettings, entityFields, saveMutation, validateFields])

  const handlePublish = useCallback(() => {
    if (!validateFields()) return

    const data: Record<string, unknown> = {
      title,
      slug,
      blocks,
      status: 'published',
      settings: pageSettings,
      ...entityFields,
    }
    saveMutation.mutate(data)
  }, [title, slug, blocks, pageSettings, entityFields, saveMutation, validateFields])

  // Block operations
  const handleAddBlock = useCallback((blockSlug: string) => {
    const newBlock: BlockInstance = {
      id: uuidv4(),
      blockSlug,
      props: {}
    }

    // Insert after selected block, or at end if none selected
    if (selectedBlockId) {
      const index = blocks.findIndex(b => b.id === selectedBlockId)
      if (index !== -1) {
        const newBlocks = [...blocks]
        newBlocks.splice(index + 1, 0, newBlock)
        setBlocks(newBlocks)
        setSelectedBlockId(newBlock.id)
        return
      }
    }

    // No selection or not found - add to end
    setBlocks(prev => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
  }, [blocks, selectedBlockId])

  // Pattern operations
  const handleAddPattern = useCallback((patternId: string) => {
    const patternRef = {
      type: 'pattern' as const,
      ref: patternId,
      id: uuidv4(),  // Unique instance ID
    }
    // Insert as if it were a block
    setBlocks(prev => [...prev, patternRef as unknown as BlockInstance])
    setSelectedBlockId(patternRef.id)
  }, [])

  const handleRemoveBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
    }
  }, [selectedBlockId])

  const handleDuplicateBlock = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId)
    if (block) {
      const duplicated: BlockInstance = {
        ...block,
        id: uuidv4(),
        props: { ...block.props }
      }
      const index = blocks.findIndex(b => b.id === blockId)
      const newBlocks = [...blocks]
      newBlocks.splice(index + 1, 0, duplicated)
      setBlocks(newBlocks)
      setSelectedBlockId(duplicated.id)
    }
  }, [blocks])

  const handleUpdateBlockProps = useCallback((blockId: string, props: Record<string, unknown>) => {
    setBlocks(prev => prev.map(block =>
      block.id === blockId ? { ...block, props } : block
    ))
  }, [])

  const handleReorderBlocks = useCallback((newBlocks: (BlockInstance | PatternReference)[]) => {
    // For now we only support BlockInstance in state, filter out PatternReferences
    // TODO: Add full pattern reference support when implementing pattern expansion
    setBlocks(newBlocks.filter((b): b is BlockInstance => !('ref' in b)))
  }, [])

  const handleMoveBlockUp = useCallback((blockId: string) => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId)
      if (index <= 0) return prev
      const newBlocks = [...prev]
      ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
      return newBlocks
    })
  }, [])

  const handleMoveBlockDown = useCallback((blockId: string) => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId)
      if (index < 0 || index >= prev.length - 1) return prev
      const newBlocks = [...prev]
      ;[newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
      return newBlocks
    })
  }, [])

  const handleEntityFieldChange = useCallback((field: string, value: unknown) => {
    setEntityFields(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleLeftSidebarToggle = useCallback((value: string | number | undefined) => {
    // If no value or clicking the same option, toggle to 'none'
    if (!value || value === leftSidebarMode) {
      setLeftSidebarMode('none')
    } else {
      setLeftSidebarMode(value as LeftSidebarMode)
    }
  }, [leftSidebarMode])

  // Handle view mode change - deselect block when switching to settings
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'settings') {
      setSelectedBlockId(null)
    }
  }, [])

  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) : undefined

  // Build public URL (only when published)
  // Uses access.basePath (new) with fallback to builder.public.basePath (deprecated)
  const publicUrl = useMemo(() => {
    if (status !== 'published' || !slug) return null
    const basePath = entityConfig.access?.basePath ?? entityConfig.builder?.public?.basePath ?? ''
    return basePath === '/' ? `/${slug}` : `${basePath}/${slug}`
  }, [status, slug, entityConfig])

  // Build ButtonGroup options for left sidebar
  const leftSidebarOptions = useMemo(() => {
    const options = [
      {
        value: 'blocks',
        label: t('sidebar.blocks'),
        dataCy: 'sidebar-blocks'
      }
    ]

    if (showFieldsOption) {
      options.push({
        value: 'fields',
        label: t('sidebar.fields'),
        dataCy: 'sidebar-fields'
      })
    }

    return options
  }, [t, showFieldsOption])

  // Build status options with translations
  const statusOptions = useMemo((): StatusOption[] => {
    return [
      { value: 'draft', label: t('status.draft') },
      { value: 'published', label: t('status.published') },
      { value: 'scheduled', label: t('status.scheduled') },
      { value: 'archived', label: t('status.archived') },
    ]
  }, [t])

  if (mode === 'edit' && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className={cn(
      "fixed inset-0 pt-14 pb-20 lg:top-16 lg:pt-0 lg:pb-0 flex flex-col bg-background z-20 transition-all duration-300",
      isCollapsed ? "lg:left-16" : "lg:left-64"
    )} data-cy={sel('blockEditor.container')}>
      {/* Top Bar - Redesigned Header */}
      <header
        className="shrink-0 border-b bg-background h-16 shadow-sm"
        data-cy={sel('blockEditor.header.container')}
      >
        <div className="h-full flex items-center justify-between px-4">
          {/* Left: Navigation & Title/Slug */}
          <div className="flex items-center gap-4 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
              data-cy={sel('blockEditor.header.backButton')}
            >
              <Link href={`/dashboard/${entitySlug}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <Separator orientation="vertical" className="h-8" />

            {/* Inline Title/Slug Editing - Borderless design */}
            <div className="flex flex-col justify-center" data-cy={sel('blockEditor.header.titleWrapper')}>
              <Input
                ref={titleInputRef}
                value={title}
                onChange={(e) => {
                  const newTitle = e.target.value
                  setTitle(newTitle)
                  // Auto-generate slug if not manually edited and slug is empty
                  if (!slugManuallyEdited || !slug) {
                    setSlug(slugify(newTitle))
                  }
                }}
                className={cn(
                  "h-auto py-0 px-0 !text-2xl font-semibold bg-transparent border-none shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50",
                  validationErrors.title && "!text-destructive placeholder:!text-destructive/50"
                )}
                placeholder={t('placeholders.title')}
                data-cy={sel('blockEditor.header.titleInput')}
              />
              {/* Slug input - conditionally shown based on entityConfig.builder.showSlug */}
              {showSlug && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-sm text-muted-foreground",
                    validationErrors.slug && "text-destructive"
                  )}
                  data-cy={sel('blockEditor.header.slugWrapper')}
                >
                  <span className={cn("opacity-50", validationErrors.slug && "opacity-100")} data-cy={sel('blockEditor.header.slugPrefix')}>/</span>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      const newSlug = e.target.value
                      setSlug(newSlug)
                      // Mark as manually edited when user types
                      if (newSlug !== slugify(title)) {
                        setSlugManuallyEdited(true)
                      }
                    }}
                    onBlur={() => {
                      // If user clears the slug, allow auto-generation again
                      if (!slug.trim()) {
                        setSlugManuallyEdited(false)
                      }
                    }}
                    className={cn(
                      "h-auto py-0 px-0 text-sm bg-transparent border-none shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40 w-auto min-w-[60px]",
                      validationErrors.slug && "!text-destructive placeholder:!text-destructive/50"
                    )}
                    placeholder={t('placeholders.slug')}
                    data-cy={sel('blockEditor.header.slugInput')}
                    style={{ width: slug ? `${Math.max(slug.length, 4)}ch` : '60px' }}
                  />
                  {/* External link - only for public entities */}
                  {isPublicEntity && publicUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 ml-1 text-muted-foreground hover:text-foreground"
                      asChild
                      data-cy={sel('blockEditor.header.externalLink')}
                    >
                      <Link href={publicUrl} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center: View Mode Toggle + Viewport Toggle */}
          <div className="flex items-center gap-3">
            {/* View Mode Tabs (Preview | Settings) */}
            <div
              className="bg-muted p-1 rounded-lg flex items-center text-sm font-medium"
              data-cy={sel('blockEditor.header.viewToggle')}
            >
              <button
                className={cn(
                  'px-3 py-1.5 rounded-md transition-all flex items-center gap-2',
                  viewMode === 'preview'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
                )}
                onClick={() => handleViewModeChange('preview')}
                data-cy={sel('blockEditor.header.viewPreview')}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{t('viewMode.preview')}</span>
              </button>
              <button
                className={cn(
                  'px-3 py-1.5 rounded-md transition-all flex items-center gap-2',
                  viewMode === 'settings'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
                )}
                onClick={() => handleViewModeChange('settings')}
                data-cy={sel('blockEditor.header.viewSettings')}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{t('viewMode.settings')}</span>
              </button>
            </div>

            {/* Viewport Toggle (only in Preview mode) */}
            {viewMode === 'preview' && (
              <ViewportToggle
                value={viewportMode}
                onChange={setViewportMode}
              />
            )}
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            {/* Status Indicator */}
            <div
              className="flex items-center gap-2 mr-2"
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  status === 'published' && 'bg-green-500',
                  status === 'draft' && 'bg-gray-400',
                  status === 'scheduled' && 'bg-blue-500',
                  status === 'archived' && 'bg-red-500'
                )}
                data-cy={sel('blockEditor.header.statusDot')}
              />
              <span
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                data-cy={sel('blockEditor.header.statusLabel')}
              >
                {statusOptions.find(o => o.value === status)?.label || status}
              </span>
            </div>

            {/* Save Draft Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending}
              data-cy={sel('blockEditor.header.saveButton')}
            >
              {t('header.actions.saveDraft')}
            </Button>

            {/* Publish/Update Button */}
            <Button
              size="sm"
              onClick={status === 'published' ? handleSave : handlePublish}
              disabled={saveMutation.isPending}
              data-cy={sel('blockEditor.header.publishButton')}
            >
              <span>{status === 'published' ? t('header.actions.update') : t('header.actions.publish')}</span>
              <Save className="h-4 w-4 ml-2" />
            </Button>

            <Separator orientation="vertical" className="h-8" />

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              data-cy={sel('blockEditor.header.settingsButton')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Always visible with tabs inside */}
        <div className="w-80 border-r overflow-hidden shrink-0 shadow-sm">
          <BlockPicker
            blocks={availableBlocks}
            onAddBlock={handleAddBlock}
            onAddPattern={handleAddPattern}
            entityConfig={entityConfig}
            entityFields={entityFields}
            onEntityFieldChange={handleEntityFieldChange}
            showFieldsTab={!!showFieldsOption}
            showPatternsTab={showPatternsTab}
            // TreeView props for Layout tab
            pageBlocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onReorderBlocks={handleReorderBlocks}
          />
        </div>

        {/* Center - Preview or Settings */}
        <div className="flex-1 overflow-hidden">
          {/* Preview Mode - Conditional rendering for performance (only one viewport mounted at a time) */}
          <div
            className={cn(
              "h-full overflow-y-auto bg-muted/30",
              viewMode !== 'preview' && "hidden"
            )}
            data-cy={sel('blockEditor.previewCanvas.container')}
          >
            {viewportMode === 'mobile' ? (
              /* Mobile viewport - Only rendered when active (lazy loaded on first use) */
              <div
                className="h-full py-4"
                data-cy={sel('blockEditor.previewCanvas.viewportMobile')}
              >
                <IframePreview
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  width={MOBILE_VIEWPORT_WIDTH}
                  onMoveUp={handleMoveBlockUp}
                  onMoveDown={handleMoveBlockDown}
                  onDuplicate={handleDuplicateBlock}
                  onRemove={handleRemoveBlock}
                />
              </div>
            ) : (
              /* Desktop viewport - Default view */
              <div
                className="min-h-full bg-background"
                data-cy={sel('blockEditor.previewCanvas.viewportDesktop')}
              >
                <BlockPreviewCanvas
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onMoveUp={handleMoveBlockUp}
                  onMoveDown={handleMoveBlockDown}
                  onDuplicate={handleDuplicateBlock}
                  onRemove={handleRemoveBlock}
                />
              </div>
            )}
          </div>

          {/* Settings Mode */}
          <div className={cn(viewMode !== 'settings' && "hidden")}>
            <ConfigPanel
              entityConfig={entityConfig}
              entityFields={entityFields}
              onEntityFieldChange={handleEntityFieldChange}
              pageSettings={pageSettings}
              onPageSettingsChange={setPageSettings}
            />
          </div>
        </div>

        {/* Right Sidebar - Block Settings */}
        <div className="w-96 border-l overflow-hidden shadow-sm">
          <BlockSettingsPanel
            block={selectedBlock}
            onUpdateProps={(props) => {
              if (selectedBlockId) {
                handleUpdateBlockProps(selectedBlockId, props)
              }
            }}
            onRemove={() => {
              if (selectedBlockId) {
                handleRemoveBlock(selectedBlockId)
              }
            }}
            onClose={() => setSelectedBlockId(null)}
          />
        </div>
      </div>
    </div>
  )
}
