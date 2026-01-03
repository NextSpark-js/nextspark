'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { ArrowLeft, Save, ExternalLink, LayoutGrid, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { BlockPicker } from './block-picker'
import { BlockCanvas } from './block-canvas'
import { BlockPreviewCanvas } from './block-preview-canvas'
import { BlockSettingsPanel } from './block-settings-panel'
import { PageSettingsPanel, type PageSettings } from './page-settings-panel'
import { EntityFieldsSidebar } from './entity-fields-sidebar'
import { StatusSelector, type StatusOption } from './status-selector'
import { BlockService } from '../../../lib/services/block.service'
import { useSidebar } from '../../../contexts/sidebar-context'
import { cn } from '../../../lib/utils'
import type { BlockInstance } from '../../../types/blocks'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'

type ViewMode = 'layout' | 'preview'

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
  const [status, setStatus] = useState<string>('draft')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [leftSidebarMode, setLeftSidebarMode] = useState<LeftSidebarMode>('blocks')
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    seo: {},
    customFields: []
  })
  // Entity-specific fields (excerpt, featuredImage, etc.)
  const [entityFields, setEntityFields] = useState<Record<string, unknown>>({})

  // Determine if we should show the Fields option
  const showFieldsOption = useMemo(() => {
    return (
      (entityConfig.builder?.sidebarFields?.length ?? 0) > 0 ||
      entityConfig.taxonomies?.enabled
    )
  }, [entityConfig])

  // Filter blocks by entity scope
  const availableBlocks = useMemo(() => {
    const allBlocks = BlockService.getAll()
    return allBlocks.filter(block =>
      block.scope?.includes(entitySlug) ||
      block.scope?.includes('*')
    )
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

  const handleSave = useCallback(() => {
    const data: Record<string, unknown> = {
      title,
      slug,
      blocks,
      status,
      settings: pageSettings,
      ...entityFields,
    }
    saveMutation.mutate(data)
  }, [title, slug, blocks, status, pageSettings, entityFields, saveMutation])

  // Block operations
  const handleAddBlock = useCallback((blockSlug: string) => {
    const newBlock: BlockInstance = {
      id: uuidv4(),
      blockSlug,
      props: {}
    }
    setBlocks(prev => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
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

  const handleReorderBlocks = useCallback((newBlocks: BlockInstance[]) => {
    setBlocks(newBlocks)
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
    )} data-cy="builder-editor">
      {/* Top Bar */}
      <div className="shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/${entitySlug}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('back')}
              </Link>
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* Left Sidebar Toggle */}
            <div data-cy="left-sidebar-toggle">
              <ButtonGroup
                options={leftSidebarOptions}
                value={leftSidebarMode === 'none' ? undefined : leftSidebarMode}
                onChange={handleLeftSidebarToggle}
                size="sm"
              />
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="entity-title" className="text-xs text-muted-foreground">
                  {t('fields.title')}
                </Label>
                <Input
                  id="entity-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 w-64"
                  placeholder={t('placeholders.title')}
                  data-cy="editor-title-input"
                />
              </div>

              <div>
                <Label htmlFor="entity-slug" className="text-xs text-muted-foreground">
                  {t('fields.slug')}
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/</span>
                  <Input
                    id="entity-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="h-8 w-48 font-mono text-sm"
                    placeholder={t('placeholders.slug')}
                    data-cy="editor-slug-input"
                  />
                </div>
              </div>

              {publicUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 px-2"
                >
                  <Link href={publicUrl} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    {t('actions.viewPage')}
                  </Link>
                </Button>
              )}

              {hasUnsavedChanges && (
                <Badge variant="secondary">{t('status.unsaved')}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div data-cy="view-mode-toggle">
              <ButtonGroup
                options={[
                  { value: 'layout', label: t('viewMode.layout'), dataCy: 'mode-layout' },
                  { value: 'preview', label: t('viewMode.preview'), dataCy: 'mode-preview' },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                size="sm"
              />
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Status Selector */}
            <StatusSelector
              value={status}
              onChange={setStatus}
              disabled={saveMutation.isPending}
              options={statusOptions}
            />

            {/* Status Badge */}
            <Badge
              variant={status === 'published' ? 'default' : 'secondary'}
              className={status === 'published' ? 'bg-success text-success-foreground' : ''}
              data-cy="status-badge"
            >
              {statusOptions.find(o => o.value === status)?.label || status}
            </Badge>

            {/* Save Button */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saveMutation.isPending}
              data-cy="save-btn"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftSidebarMode !== 'none' && (
          <div className="w-80 border-r overflow-hidden shrink-0">
            {leftSidebarMode === 'blocks' && (
              <BlockPicker blocks={availableBlocks} onAddBlock={handleAddBlock} />
            )}
            {leftSidebarMode === 'fields' && showFieldsOption && (
              <EntityFieldsSidebar
                entityConfig={entityConfig}
                fields={entityFields}
                onChange={handleEntityFieldChange}
              />
            )}
          </div>
        )}

        {/* Center - Block Canvas / Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {viewMode === 'layout' ? (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                <BlockCanvas
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onRemoveBlock={handleRemoveBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onReorder={handleReorderBlocks}
                  onUpdateProps={handleUpdateBlockProps}
                  onAddBlock={handleAddBlock}
                />

                {/* Page Settings - Only in Layout view and if SEO is enabled */}
                {entityConfig.builder?.seo && (
                  <PageSettingsPanel
                    settings={pageSettings}
                    onChange={setPageSettings}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-background">
              <BlockPreviewCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onMoveUp={handleMoveBlockUp}
                onMoveDown={handleMoveBlockDown}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar - Block Settings */}
        <div className="w-96 border-l overflow-hidden">
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
          />
        </div>
      </div>
    </div>
  )
}
