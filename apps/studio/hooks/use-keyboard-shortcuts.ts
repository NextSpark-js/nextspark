import { useEffect, useCallback, useState } from 'react'

export interface Shortcut {
  key: string
  modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[]
  label: string
  description: string
  action: () => void
}

/**
 * Registers global keyboard shortcuts on the build page.
 * Ignores shortcuts when the user is typing in an input/textarea.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const [showHelp, setShowHelp] = useState(false)

  const toggleHelp = useCallback(() => setShowHelp(prev => !prev), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs (except for Escape and Cmd+Enter)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const shortcut of shortcuts) {
        const modMatch = shortcut.modifiers.every(mod => {
          if (mod === 'meta') return e.metaKey || e.ctrlKey // Cmd on Mac, Ctrl on Windows
          if (mod === 'ctrl') return e.ctrlKey
          if (mod === 'shift') return e.shiftKey
          if (mod === 'alt') return e.altKey
          return false
        })

        if (!modMatch) continue
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue

        // Allow Cmd+Enter and Escape in inputs, block others
        const isEnterShortcut = shortcut.key === 'Enter'
        const isEscapeShortcut = shortcut.key === 'Escape'
        if (isInput && !isEnterShortcut && !isEscapeShortcut) continue

        e.preventDefault()
        e.stopPropagation()
        shortcut.action()
        return
      }

      // Cmd+/ or Ctrl+/ toggles help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleHelp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, toggleHelp])

  return { showHelp, setShowHelp, toggleHelp }
}
