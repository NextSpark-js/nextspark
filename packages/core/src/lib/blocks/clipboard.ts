import type { BlockInstance } from '../../types/blocks'

const CLIPBOARD_KEY = 'nextspark:block-clipboard'

export interface ClipboardBlock {
  blockSlug: string
  props: Record<string, unknown>
  copiedAt: number
}

export function copyBlockToClipboard(block: BlockInstance): void {
  const data: ClipboardBlock = {
    blockSlug: block.blockSlug,
    props: { ...block.props },
    copiedAt: Date.now(),
  }
  localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data))
}

export function getBlockFromClipboard(): ClipboardBlock | null {
  const raw = localStorage.getItem(CLIPBOARD_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ClipboardBlock
  } catch {
    return null
  }
}

export function hasBlockInClipboard(): boolean {
  return localStorage.getItem(CLIPBOARD_KEY) !== null
}

export function clearBlockClipboard(): void {
  localStorage.removeItem(CLIPBOARD_KEY)
}
