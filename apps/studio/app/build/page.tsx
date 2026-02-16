'use client'

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  RotateCcw, RefreshCw, PanelLeftClose, PanelLeft,
  Code2, Eye, Settings2, Loader2, Zap, Monitor, Tablet, Smartphone,
  ChevronDown, LayoutGrid, FolderOpen,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/error-boundary'
import { useStudioChat } from '@/lib/use-studio-chat'
import { useGitHub } from '@/lib/use-github'
import { ChatMessages } from '@/components/chat-messages'
import { PromptInput } from '@/components/prompt-input'
import { ConfigPreview } from '@/components/config-preview'
import { EntityPreview } from '@/components/entity-preview'
import { FileTree, countFiles } from '@/components/file-tree'
import { CodeViewer } from '@/components/code-viewer'
import { PreviewFrame } from '@/components/preview-frame'
import { DeployMenu } from '@/components/deploy-menu'
import { DeployModal } from '@/components/deploy-modal'
import { GitHubPushModal } from '@/components/github-push-modal'
import { PageEditor } from '@/components/page-editor'

type RightTab = 'preview' | 'pages' | 'code' | 'config'
type Viewport = 'desktop' | 'tablet' | 'mobile'

function BuildContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    status, messages, result, error, project, pages, sessionId,
    sendPrompt, reset, fetchFiles, startPreview, updatePages, loadSession,
  } = useStudioChat()

  const github = useGitHub()
  const [showPushModal, setShowPushModal] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)

  const [activeTab, setActiveTab] = useState<RightTab>('preview')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [errorExpanded, setErrorExpanded] = useState(false)
  const autoStartedRef = useRef(false)
  const sessionLoadedRef = useRef(false)

  // After GitHub OAuth redirect, re-check status
  useEffect(() => {
    if (searchParams.get('gh_connected') === '1') {
      github.checkStatus()
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleDownloadZip = useCallback(() => {
    if (project.slug) {
      window.open(`/api/export?slug=${encodeURIComponent(project.slug)}`, '_blank')
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

  const handleDeployVPS = useCallback(() => {
    setShowDeployModal(true)
  }, [])

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

          <DeployMenu
            slug={project.slug}
            authenticated={github.authenticated}
            configured={github.configured}
            user={github.user}
            onPushToGitHub={handleOpenPushModal}
            onDownloadZip={handleDownloadZip}
            onConnect={github.connect}
            onDisconnect={github.disconnect}
            onDeployVPS={handleDeployVPS}
          />

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
          <div className="flex flex-col w-[340px] h-full border-r border-border bg-bg-surface/20">
            <ChatMessages messages={messages} status={status} />
            <PromptInput onSubmit={sendPrompt} disabled={isProcessing} />
          </div>
        </div>

        {/* Right — Preview / Pages / Code / Config */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex h-10 items-center border-b border-border bg-bg-surface/30 px-1 flex-shrink-0">
            <div className="flex items-center gap-0.5 px-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-bg-elevated text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
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
          <div className="flex-1 overflow-hidden">
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
              />
            )}

            {activeTab === 'pages' && (
              <PageEditor pages={pages} onUpdatePages={updatePages} />
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
              <div className="overflow-y-auto p-5 space-y-5">
                {result ? (
                  <>
                    <ConfigPreview result={result} />
                    <EntityPreview result={result} />
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
