import type { BlockInstance } from '../../types/blocks'

const CLIPBOARD_KEY = 'nextspark:block-clipboard'
const CLIPBOARD_V2_KEY = 'nextspark:block-clipboard-v2'

// V1 types (single block - kept for backward compat)
export interface ClipboardBlock {
  blockSlug: string
  props: Record<string, unknown>
  copiedAt: number
}

// V2 types (multi-block)
export interface ClipboardDataV2 {
  version: 2
  blocks: Array<{
    blockSlug: string
    props: Record<string, unknown>
  }>
  sourceEntitySlug?: string
  copiedAt: number
}

// --- V1 API (single block, backward compatible) ---

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
  localStorage.removeItem(CLIPBOARD_V2_KEY)
}

// --- V2 API (multi-block) ---

export function copyBlocksToClipboard(blocks: BlockInstance[], sourceEntitySlug?: string): void {
  const data: ClipboardDataV2 = {
    version: 2,
    blocks: blocks.map(b => ({
      blockSlug: b.blockSlug,
      props: { ...b.props },
    })),
    sourceEntitySlug,
    copiedAt: Date.now(),
  }
  localStorage.setItem(CLIPBOARD_V2_KEY, JSON.stringify(data))

  // Sync v1 key with last block for backward compat
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1]
    copyBlockToClipboard(last)
  }
}

export function getBlocksFromClipboard(): ClipboardDataV2 | null {
  const raw = localStorage.getItem(CLIPBOARD_V2_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.version === 2 && Array.isArray(data.blocks)) {
      return data as ClipboardDataV2
    }
    return null
  } catch {
    return null
  }
}

export function getClipboardBlockCount(): number {
  const v2 = getBlocksFromClipboard()
  if (v2) return v2.blocks.length
  return hasBlockInClipboard() ? 1 : 0
}

export function hasClipboardBlocks(): boolean {
  return getClipboardBlockCount() > 0
}
