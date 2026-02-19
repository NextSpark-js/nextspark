'use client'

import { Keyboard, X } from 'lucide-react'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '\u2318' : 'Ctrl'

const SHORTCUTS = [
  { keys: `${MOD} + Enter`, description: 'Submit prompt' },
  { keys: `${MOD} + B`, description: 'Toggle chat panel' },
  { keys: `${MOD} + Shift + E`, description: 'Export ZIP' },
  { keys: `${MOD} + /`, description: 'Toggle this help' },
]

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 w-56 rounded-xl border border-border bg-bg-surface/95 shadow-xl shadow-black/30 backdrop-blur-md animate-card-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Keyboard className="h-3 w-3 text-accent" />
          <span className="text-[11px] font-semibold text-text-secondary">Shortcuts</span>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="p-2 space-y-0.5">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-bg-hover/40">
            <span className="text-[11px] text-text-muted">{s.description}</span>
            <kbd className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-text-muted/80 border border-border/50">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}
