import type { BlockInstance } from '../../types/blocks'

const CLIPBOARD_KEY = 'nextspark:block-clipboard'

export interface ClipboardBlock {
  blockSlug: string
  props: Record<string, unknown>
}

export interface ClipboardData {
  blocks: ClipboardBlock[]
  sourceEntitySlug?: string
  copiedAt: number
}

export function copyBlocksToClipboard(blocks: BlockInstance[], sourceEntitySlug?: string): void {
  const data: ClipboardData = {
    blocks: blocks.map(b => ({
      blockSlug: b.blockSlug,
      props: { ...b.props },
    })),
    sourceEntitySlug,
    copiedAt: Date.now(),
  }
  localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data))
}

export function copyBlockToClipboard(block: BlockInstance): void {
  copyBlocksToClipboard([block])
}

export function getBlocksFromClipboard(): ClipboardData | null {
  const raw = localStorage.getItem(CLIPBOARD_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data?.blocks)) {
      return data as ClipboardData
    }
    return null
  } catch {
    return null
  }
}

export function getBlockFromClipboard(): ClipboardBlock | null {
  const data = getBlocksFromClipboard()
  if (!data || data.blocks.length === 0) return null
  return data.blocks[data.blocks.length - 1]
}

export function getClipboardBlockCount(): number {
  return getBlocksFromClipboard()?.blocks.length ?? 0
}

export function hasClipboardBlocks(): boolean {
  return getClipboardBlockCount() > 0
}

export function clearBlockClipboard(): void {
  localStorage.removeItem(CLIPBOARD_KEY)
}
