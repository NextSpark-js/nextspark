/**
 * Deploy dropdown menu — Deploy to VPS, Push to GitHub, or Download ZIP
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Github, Download, ExternalLink, LogOut, Server } from 'lucide-react'
import type { GitHubUser } from '@/lib/use-github'

interface DeployMenuProps {
  slug: string | null
  authenticated: boolean
  configured: boolean
  user: GitHubUser | null
  onPushToGitHub: () => void
  onDownloadZip: () => void
  onConnect: () => void
  onDisconnect: () => void
  onDeployVPS?: () => void
}

export function DeployMenu({
  slug,
  authenticated,
  configured,
  user,
  onPushToGitHub,
  onDownloadZip,
  onConnect,
  onDisconnect,
  onDeployVPS,
}: DeployMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const disabled = !slug

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const handleAction = useCallback((action: () => void) => {
    setOpen(false)
    action()
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
          disabled
            ? 'text-text-muted/30 cursor-not-allowed'
            : open
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
        }`}
      >
        <ExternalLink className="h-3 w-3" />
        Deploy
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-bg-surface shadow-xl z-50 overflow-hidden">
          {/* Deploy to VPS */}
          {onDeployVPS && (
            <>
              <button
                onClick={() => handleAction(onDeployVPS)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <Server className="h-4 w-4" />
                <div>
                  <div className="font-medium">Deploy to VPS</div>
                  <div className="text-[10px] text-text-muted">Build & start with PM2</div>
                </div>
              </button>
              <div className="border-t border-border" />
            </>
          )}

          {/* GitHub section */}
          {configured && authenticated && user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="h-5 w-5 rounded-full"
                />
                <span className="text-[11px] text-text-secondary font-medium truncate">
                  {user.login}
                </span>
                <button
                  onClick={() => handleAction(onDisconnect)}
                  className="ml-auto text-text-muted/50 hover:text-text-secondary transition-colors"
                  title="Disconnect GitHub"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>

              {/* Push to GitHub */}
              <button
                onClick={() => handleAction(onPushToGitHub)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <Github className="h-4 w-4" />
                <div>
                  <div className="font-medium">Push to GitHub</div>
                  <div className="text-[10px] text-text-muted">Create repo & push code</div>
                </div>
              </button>
            </>
          ) : configured ? (
            <button
              onClick={() => handleAction(onConnect)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <Github className="h-4 w-4" />
              <div>
                <div className="font-medium">Connect GitHub</div>
                <div className="text-[10px] text-text-muted">Sign in to push your project</div>
              </div>
            </button>
          ) : (
            <div className="px-3 py-2.5 text-[10px] text-text-muted">
              <Github className="h-4 w-4 mb-1 opacity-30" />
              GitHub not configured
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Download ZIP */}
          <button
            onClick={() => handleAction(onDownloadZip)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <Download className="h-4 w-4" />
            <div>
              <div className="font-medium">Download ZIP</div>
              <div className="text-[10px] text-text-muted">Download project files</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
