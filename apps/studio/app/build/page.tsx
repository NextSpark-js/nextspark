'use client'

import { useEffect, useState, useCallback, useRef, useMemo, Suspense, type RefObject } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  RotateCcw, RefreshCw, PanelLeftClose, PanelLeft,
  Code2, Eye, Settings2, Loader2, Zap, Monitor, Tablet, Smartphone,
  ChevronDown, LayoutGrid, FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { useStudioChat } from '@/lib/use-studio-chat'
import { useGitHub, type PushResult } from '@/lib/use-github'
import type { StudioResult, PreviewError } from '@/lib/types'
import { ChatMessages } from '@/components/chat-messages'
import { PromptInput } from '@/components/prompt-input'
import { ConfigPreview } from '@/components/config-preview'
import { EntityEditor } from '@/components/entity-editor'
import { FileTree, countFiles } from '@/components/file-tree'
import { CodeViewer } from '@/components/code-viewer'
import { PreviewFrame } from '@/components/preview-frame'
import { DeployMenu } from '@/components/deploy-menu'
import { DeployModal } from '@/components/deploy-modal'
import { GitHubPushModal } from '@/components/github-push-modal'
import { PageEditor } from '@/components/page-editor'
import { useBlockSelector } from '@/hooks/use-block-selector'
import { usePreviewErrors } from '@/hooks/use-preview-errors'
import { useKeyboardShortcuts, type Shortcut } from '@/hooks/use-keyboard-shortcuts'
import { ShortcutsHelp } from '@/components/shortcuts-help'
import { useOnboardingTour, type TourStep } from '@/hooks/use-onboarding-tour'
import { OnboardingTour } from '@/components/onboarding-tour'

type RightTab = 'preview' | 'pages' | 'code' | 'config'
type Viewport = 'desktop' | 'tablet' | 'mobile'

function BuildContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    status, messages, result, error, project, pages, sessionId,
    sendPrompt, sendChatMessage, reset, fetchFiles, startPreview, updatePages, updateResult, loadSession, clearPreviewStale, markPreviewStale,
  } = useStudioChat()

  const github = useGitHub()
  const [showPushModal, setShowPushModal] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)

  const [activeTab, setActiveTab] = useState<RightTab>('preview')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [errorExpanded, setErrorExpanded] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [externalSelection, setExternalSelection] = useState<{ pageIndex: number; blockIndex: number } | null>(null)
  const [promptPrefill, setPromptPrefill] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const autoStartedRef = useRef(false)
  const sessionLoadedRef = useRef(false)

  // After GitHub OAuth redirect, re-check status
  useEffect(() => {
    if (searchParams.get('gh_connected') === '1') {
      github.checkStatus()
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load GitHub repo from session result (on session resume)
  useEffect(() => {
    if (result?.githubRepo && !github.lastRepo) {
      github.setLastRepo(result.githubRepo as PushResult)
    }
  }, [result?.githubRepo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist GitHub repo to session after successful push/update
  useEffect(() => {
    if (github.pushStep === 'done' && github.lastRepo && sessionId) {
      const updatedResult = { ...(result || {}), githubRepo: github.lastRepo }
      updateResult(updatedResult as StudioResult)
      fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: updatedResult }),
      }).catch(() => {})
      toast.success(`Pushed to GitHub: ${github.lastRepo.fullName}`)
    }
    if (github.pushStep === 'error' && github.pushError) {
      toast.error(`GitHub push failed: ${github.pushError}`)
    }
  }, [github.pushStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing session or start new generation from URL params
  useEffect(() => {
    if (sessionLoadedRef.current) return

    const sessionParam = searchParams.get('session')

    if (sessionParam && status === 'idle') {
      sessionLoadedRef.current = true
      loadSession(sessionParam).then((result) => {
        // Fresh session — trigger generation with stored prompt
        if (result && typeof result === 'object' && 'prompt' in result) {
          sendPrompt(result.prompt, result.id)
        }
      })
    }
  }, [searchParams, status, sendPrompt, loadSession])

  // When project is ready, auto-start preview
  useEffect(() => {
    if (
      project.phase === 'ready' &&
      project.slug &&
      !project.previewUrl &&
      !project.previewLoading &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true
      startPreview(project.slug)
      setActiveTab('preview')
    }
  }, [project.phase, project.slug, project.previewUrl, project.previewLoading, startPreview])

  // Reset autoStarted ref when user resets
  const handleReset = useCallback(() => {
    autoStartedRef.current = false
    sessionLoadedRef.current = false
    reset()
    router.push('/')
  }, [reset, router])

  const isProcessing = status === 'loading' || status === 'streaming'
  const isComplete = status === 'complete'
  const projectReady = project.phase === 'ready' && !!project.slug

  const fileCount = useMemo(() => countFiles(project.files), [project.files])
  const isFilesLoading = projectReady && project.files.length === 0

  const handleStartPreview = useCallback(() => {
    if (project.slug) {
      startPreview(project.slug)
      setActiveTab('preview')
    }
  }, [project.slug, startPreview])

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path)
  }, [])

  // Block selector: map iframe click to page+block index
  const handleBlockSelected = useCallback((blockSlug: string, blockIndex: number) => {
    if (pages.length === 0 || blockIndex < 0) return

    // Find which page is currently visible in the preview.
    // The preview renders one page at a time; blocks are numbered sequentially.
    // For now, find the page whose block count range contains blockIndex,
    // or fall back to the first page that has a matching blockType.
    let cumulative = 0
    for (let pi = 0; pi < pages.length; pi++) {
      const page = pages[pi]
      if (blockIndex < cumulative + page.blocks.length) {
        const localIndex = blockIndex - cumulative
        setExternalSelection({ pageIndex: pi, blockIndex: localIndex })
        setActiveTab('pages')
        setSelectMode(false)
        return
      }
      cumulative += page.blocks.length
    }

    // Fallback: match by slug on first page
    const firstPage = pages[0]
    const idx = firstPage.blocks.findIndex(b => b.blockType === blockSlug)
    if (idx >= 0) {
      setExternalSelection({ pageIndex: 0, blockIndex: idx })
      setActiveTab('pages')
      setSelectMode(false)
    }
  }, [pages])

  const handleDashboardSelected = useCallback((zone: string, entitySlug: string | null, label: string) => {
    setSelectMode(false)

    // Prefer entitySlug for entity-related zones, fallback to label
    const displayName = entitySlug || label

    let prompt = ''
    switch (zone) {
      case 'entity-nav':
      case 'entity-card':
        prompt = `Modify the "${displayName}" entity: `
        break
      case 'entity-table':
        prompt = `Modify the "${displayName}" table view: `
        break
      case 'create-button':
        prompt = `Customize the "${displayName}" create form: `
        break
      case 'sidebar':
        prompt = `Modify the sidebar navigation: `
        break
      case 'recent-activity':
        prompt = `Modify the recent activity section: `
        break
      case 'search-filter':
        prompt = `Modify "${displayName}" search and filters: `
        break
      default:
        prompt = `Modify this dashboard section: `
    }

    if (!chatOpen) setChatOpen(true)
    setPromptPrefill(prompt)
  }, [chatOpen])

  useBlockSelector(iframeRef as RefObject<HTMLIFrameElement | null>, selectMode, handleBlockSelected, handleDashboardSelected)

  // Preview error detection — poll every 3s when preview is active
  const previewErrors = usePreviewErrors(project.previewUrl ? project.slug : null)

  const handleFixError = useCallback((error: PreviewError) => {
    const prompt = error.file
      ? `Fix this error in ${error.file}${error.line ? `:${error.line}` : ''}:\n\n${error.message}\n\nFull error output:\n\`\`\`\n${error.fullOutput}\n\`\`\``
      : `Fix this compilation error:\n\n${error.message}\n\nFull error output:\n\`\`\`\n${error.fullOutput}\n\`\`\``

    if (!chatOpen) setChatOpen(true)
    sendChatMessage(prompt)
  }, [sendChatMessage, chatOpen])

  const handleFixAll = useCallback(() => {
    const errorSummary = previewErrors.map(e =>
      `- ${e.file || 'Unknown'}${e.line ? `:${e.line}` : ''}: ${e.message}`
    ).join('\n')

    const prompt = `Fix these ${previewErrors.length} compilation errors:\n\n${errorSummary}\n\nFull output:\n\`\`\`\n${previewErrors.map(e => e.fullOutput).join('\n---\n')}\n\`\`\``

    if (!chatOpen) setChatOpen(true)
    sendChatMessage(prompt)
  }, [previewErrors, sendChatMessage, chatOpen])

  // Keyboard shortcuts — submit prompt ref for Cmd+Enter
  const promptSubmitRef = useRef<(() => void) | null>(null)
  promptSubmitRef.current = projectReady ? sendChatMessage.bind(null, '') : sendPrompt.bind(null, '')

  const shortcuts = useMemo<Shortcut[]>(() => [
    {
      key: 'Enter',
      modifiers: ['meta'],
      label: 'Cmd+Enter',
      description: 'Submit prompt',
      action: () => {
        // Focus the textarea and trigger form submission via Enter
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea')
        if (textarea && textarea.value.trim()) {
          const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          textarea.dispatchEvent(event)
        }
      },
    },
    {
      key: 'b',
      modifiers: ['meta'],
      label: 'Cmd+B',
      description: 'Toggle chat panel',
      action: () => setChatOpen(prev => !prev),
    },
    {
      key: 'E',
      modifiers: ['meta', 'shift'],
      label: 'Cmd+Shift+E',
      description: 'Export ZIP',
      action: () => {
        if (project.slug) {
          window.open(`/api/export?slug=${encodeURIComponent(project.slug)}`, '_blank')
          toast.success('Downloading ZIP export')
        }
      },
    },
  ], [project.slug, projectReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts)

  // Onboarding tour
  const tourSteps = useMemo<TourStep[]>(() => [
    {
      target: '[data-tour="chat-panel"]',
      title: 'AI Chat',
      description: 'Describe your app idea here. AI will generate a full Next.js project with entities, pages, and a live preview.',
      placement: 'right',
    },
    {
      target: '[data-tour="preview-tab"]',
      title: 'Live Preview',
      description: 'See your app running live as it\'s generated. Switch between desktop, tablet, and mobile viewports.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-bar"]',
      title: 'Pages, Code & Config',
      description: 'Switch between the page editor, source code browser, and project configuration to explore and customize your app.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="deploy-menu"]',
      title: 'Deploy & Export',
      description: 'Deploy to VPS, Vercel, or Railway. Push to GitHub or download as a ZIP file — all in one click.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="shortcuts-btn"]',
      title: 'Keyboard Shortcuts',
      description: 'Press Cmd+/ (or Ctrl+/) anytime to see all available keyboard shortcuts. Press ? for quick access.',
      placement: 'top',
    },
  ], [])

  const tour = useOnboardingTour(tourSteps)

  const handleDownloadZip = useCallback(() => {
    if (project.slug) {
      window.open(`/api/export?slug=${encodeURIComponent(project.slug)}`, '_blank')
      toast.success('Downloading ZIP export')
    }
  }, [project.slug])

  const handleOpenPushModal = useCallback(() => {
    github.resetPush()
    setShowPushModal(true)
  }, [github])

  const handleClosePushModal = useCallback(() => {
    setShowPushModal(false)
    github.resetPush()
  }, [github])

  const handleUpdateGitHub = useCallback(() => {
    if (!project.slug) return
    github.resetPush()
    setShowPushModal(true)
    // Trigger update immediately
    github.update({ slug: project.slug })
  }, [project.slug, github])

  const handleDeployVPS = useCallback(() => {
    setShowDeployModal(true)
  }, [])

  const handleDeployVercel = useCallback(() => {
    if (!github.lastRepo) {
      toast.error('Push to GitHub first to deploy to Vercel')
      return
    }
    const repo = github.lastRepo.fullName
    const envKeys = 'DATABASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL'
    const url = `https://vercel.com/new/import?s=https://github.com/${repo}&project-name=${project.slug || 'my-app'}&env=${envKeys}`
    window.open(url, '_blank')
    toast.success('Opening Vercel import...')
  }, [github.lastRepo, project.slug])

  const handleDeployRailway = useCallback(() => {
    if (!github.lastRepo) {
      toast.error('Push to GitHub first to deploy to Railway')
      return
    }
    const repo = github.lastRepo.fullName
    const url = `https://railway.com/new/github/${repo}`
    window.open(url, '_blank')
    toast.success('Opening Railway import...')
  }, [github.lastRepo])

  const tabs: { id: RightTab; label: string; icon: typeof Code2 }[] = [
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'pages', label: 'Pages', icon: LayoutGrid },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'config', label: 'Config', icon: Settings2 },
  ]

  const viewports: { id: Viewport; icon: typeof Monitor; label: string }[] = [
    { id: 'desktop', icon: Monitor, label: 'Desktop' },
    { id: 'tablet', icon: Tablet, label: 'Tablet' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
  ]

  // Error display: truncate if long, allow expand
  const errorText = error || ''
  const isLongError = errorText.length > 100
  const displayError = isLongError && !errorExpanded
    ? errorText.slice(0, 100) + '...'
    : errorText

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      {/* Header */}
      <header className="flex h-11 items-center justify-between border-b border-border bg-bg-surface/50 px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
            title={chatOpen ? 'Collapse chat' : 'Expand chat'}
          >
            {chatOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-semibold tracking-wide text-text-secondary lowercase">
              nextspark studio
            </span>
          </div>

          {project.slug && (
            <>
              <span className="text-text-muted/40">/</span>
              <span className="text-xs font-mono text-text-muted">{project.slug}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isProcessing && (
            <div className="flex items-center gap-1.5 rounded-full bg-accent-muted px-2.5 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-ring" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="text-[11px] text-accent font-medium">
                {project.phase === 'generating' ? 'Generating' : project.phase === 'setting_up_db' ? 'Setting up DB' : 'Analyzing'}
              </span>
            </div>
          )}

          {project.phase === 'setting_up_db' && !isProcessing && (
            <div className="flex items-center gap-1.5 rounded-full bg-accent-muted px-2.5 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-ring" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="text-[11px] text-accent font-medium">Setting up DB</span>
            </div>
          )}

          {isComplete && projectReady && !isProcessing && project.phase !== 'setting_up_db' && (
            <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[11px] text-success font-medium">Ready</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-error" />
              <span className="text-[11px] text-error font-medium">Error</span>
            </div>
          )}

          <div data-tour="deploy-menu">
            <DeployMenu
              slug={project.slug}
              authenticated={github.authenticated}
              configured={github.configured}
              user={github.user}
              lastRepo={github.lastRepo}
              onPushToGitHub={handleOpenPushModal}
              onUpdateGitHub={handleUpdateGitHub}
              onDownloadZip={handleDownloadZip}
              onConnect={github.connect}
              onDisconnect={github.disconnect}
              onDeployVPS={handleDeployVPS}
              onDeployVercel={handleDeployVercel}
              onDeployRailway={handleDeployRailway}
            />
          </div>

          <div className="h-4 w-px bg-border" />

          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
            title="View all projects"
          >
            <FolderOpen className="h-3 w-3" />
            Projects
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            New
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Collapsible Chat Panel */}
        <div
          className="h-full overflow-hidden flex-shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: chatOpen ? 340 : 0 }}
        >
          <div className="flex flex-col w-[340px] h-full border-r border-border bg-bg-surface/20" data-tour="chat-panel">
            <ChatMessages messages={messages} status={status} />
            <PromptInput
              onSubmit={projectReady ? sendChatMessage : sendPrompt}
              disabled={isProcessing}
              placeholder={projectReady ? 'Modify your project...' : undefined}
              showSuggestions={projectReady && isComplete}
              prefill={promptPrefill}
              onPrefillConsumed={() => setPromptPrefill('')}
            />
          </div>
        </div>

        {/* Right — Preview / Pages / Code / Config */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex h-10 items-center border-b border-border bg-bg-surface/30 px-1 flex-shrink-0">
            <div className="flex items-center gap-0.5 px-1" data-tour="tab-bar">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-tour={tab.id === 'preview' ? 'preview-tab' : undefined}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-bg-elevated text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.id === 'preview' && previewErrors.length > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold px-1">
                        {previewErrors.length}
                      </span>
                    )}
                    {tab.id === 'pages' && pages.length > 0 && (
                      <span className="ml-0.5 text-[9px] text-accent font-normal">
                        {pages.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Viewport controls — always visible in preview tab (disabled when no preview) */}
            {activeTab === 'preview' && (
              <div className="ml-auto flex items-center gap-1 px-2">
                {!project.previewUrl && (
                  <div className="flex items-center rounded-md bg-bg/80 border border-border/40 px-2.5 py-0.5 mr-2">
                    <span className="text-[10px] font-mono text-text-muted/40 truncate">
                      http://localhost:3000
                    </span>
                  </div>
                )}
                {viewports.map((vp) => {
                  const Icon = vp.icon
                  const isActive = viewport === vp.id
                  const hasPreview = !!project.previewUrl
                  return (
                    <button
                      key={vp.id}
                      onClick={() => setViewport(vp.id)}
                      disabled={!hasPreview}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        !hasPreview
                          ? 'text-text-muted/20 cursor-not-allowed'
                          : isActive
                          ? 'bg-bg-elevated text-text-primary'
                          : 'text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover/50'
                      }`}
                      title={vp.label}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className={`flex-1 ${activeTab === 'config' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            {activeTab === 'preview' && (
              <PreviewFrame
                url={project.previewUrl}
                loading={project.previewLoading}
                onStart={handleStartPreview}
                canStart={projectReady}
                viewport={viewport}
                isProcessing={isProcessing}
                phase={project.phase}
                steps={project.steps}
                slug={project.slug}
                result={result}
                previewStale={project.previewStale}
                onClearStale={clearPreviewStale}
                selectMode={selectMode}
                onToggleSelectMode={() => setSelectMode(prev => !prev)}
                iframeRef={iframeRef}
                errors={previewErrors}
                onFixError={handleFixError}
                onFixAll={handleFixAll}
              />
            )}

            {activeTab === 'pages' && (
              <PageEditor
                pages={pages}
                onUpdatePages={updatePages}
                slug={project.slug}
                externalSelection={externalSelection}
                onClearExternalSelection={() => setExternalSelection(null)}
                onFilesChanged={markPreviewStale}
              />
            )}

            {activeTab === 'code' && (
              <div className="flex h-full">
                <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto bg-bg-surface/20">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      Explorer
                      {fileCount > 0 && (
                        <span className="ml-1.5 text-[9px] font-normal text-text-muted/50">
                          ({fileCount})
                        </span>
                      )}
                    </span>
                    {projectReady && (
                      <button
                        onClick={() => project.slug && fetchFiles(project.slug)}
                        className="text-text-muted/50 hover:text-text-secondary transition-colors"
                        title="Refresh files"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <FileTree
                    files={project.files}
                    selectedPath={selectedFile}
                    onSelectFile={handleSelectFile}
                    isLoading={isFilesLoading}
                    hasProject={projectReady}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {project.slug ? (
                    <CodeViewer slug={project.slug} filePath={selectedFile} />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center space-y-3 opacity-50">
                        <Code2 className="h-14 w-14 mx-auto text-text-muted" />
                        <p className="text-xs text-text-muted">Your code will appear here once generation completes</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="p-5 space-y-5">
                {result ? (
                  <>
                    <ConfigPreview result={result} />
                    <EntityEditor
                      result={result}
                      slug={project.slug}
                      onUpdateResult={updateResult}
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center pt-20">
                    <div className="text-center space-y-3 opacity-50">
                      <Settings2 className="h-14 w-14 mx-auto text-text-muted" />
                      <p className="text-xs text-text-muted">
                        {isProcessing ? 'Configuration will appear here...' : 'Describe your app to start'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error banner — expandable */}
      {error && (
        <div className="border-t border-error/20 bg-error/5 px-4 py-2 flex-shrink-0">
          <div className="flex items-start gap-2">
            <p className="text-xs text-error/80 flex-1">{displayError}</p>
            {isLongError && (
              <button
                onClick={() => setErrorExpanded(!errorExpanded)}
                className="flex items-center gap-0.5 text-[10px] text-error/60 hover:text-error/90 transition-colors flex-shrink-0"
              >
                {errorExpanded ? 'Less' : 'Details'}
                <ChevronDown className={`h-3 w-3 transition-transform ${errorExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deploy to VPS Modal */}
      {showDeployModal && project.slug && (
        <DeployModal
          slug={project.slug}
          onClose={() => setShowDeployModal(false)}
        />
      )}

      {/* GitHub Push Modal */}
      {showPushModal && project.slug && github.user && (
        <GitHubPushModal
          slug={project.slug}
          user={github.user}
          pushStep={github.pushStep}
          pushError={github.pushError}
          pushResult={github.pushResult}
          description={result?.wizardConfig?.projectDescription}
          onPush={github.push}
          onClose={handleClosePushModal}
        />
      )}

      {/* Keyboard shortcuts help */}
      <ShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Shortcuts help toggle button */}
      <button
        onClick={() => setShowHelp(prev => !prev)}
        data-tour="shortcuts-btn"
        className="fixed bottom-4 right-4 z-40 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-bg-surface/80 text-text-muted/50 hover:text-text-secondary hover:bg-bg-elevated transition-all shadow-lg shadow-black/20 backdrop-blur-sm"
        title="Keyboard shortcuts (Cmd+/)"
      >
        <span className="text-[11px] font-mono">?</span>
      </button>

      {/* Replay tour button (shown after tour is completed) */}
      {tour.hasCompleted && (
        <button
          onClick={tour.start}
          className="fixed bottom-4 right-14 z-40 flex h-7 items-center gap-1 rounded-lg border border-border bg-bg-surface/80 px-2 text-text-muted/50 hover:text-text-secondary hover:bg-bg-elevated transition-all shadow-lg shadow-black/20 backdrop-blur-sm"
          title="Replay onboarding tour"
        >
          <span className="text-[11px]">Tour</span>
        </button>
      )}

      {/* Onboarding tour overlay */}
      <OnboardingTour
        isActive={tour.isActive}
        step={tour.step}
        currentStep={tour.currentStep}
        totalSteps={tour.totalSteps}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />
    </div>
  )
}

export default function BuildPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-bg">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      }>
        <BuildContent />
      </Suspense>
    </ErrorBoundary>
  )
}
