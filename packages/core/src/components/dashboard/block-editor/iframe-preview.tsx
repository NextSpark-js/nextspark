'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import type { BlockInstance } from '../../../types/blocks'

/**
 * PostMessage Protocol Types
 */
interface IframeMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface IframeReadyMessage extends IframeMessage {
  type: 'READY'
}

interface BlockClickedMessage extends IframeMessage {
  type: 'BLOCK_CLICKED'
  blockId: string
}

interface ContentHeightMessage extends IframeMessage {
  type: 'CONTENT_HEIGHT'
  height: number
}

interface BlockMoveUpMessage extends IframeMessage {
  type: 'BLOCK_MOVE_UP'
  blockId: string
}

interface BlockMoveDownMessage extends IframeMessage {
  type: 'BLOCK_MOVE_DOWN'
  blockId: string
}

interface BlockDuplicateMessage extends IframeMessage {
  type: 'BLOCK_DUPLICATE'
  blockId: string
}

interface BlockRemoveMessage extends IframeMessage {
  type: 'BLOCK_REMOVE'
  blockId: string
}

type IncomingMessage =
  | IframeReadyMessage
  | BlockClickedMessage
  | ContentHeightMessage
  | BlockMoveUpMessage
  | BlockMoveDownMessage
  | BlockDuplicateMessage
  | BlockRemoveMessage

export interface IframePreviewProps {
  blocks: BlockInstance[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  width?: number
  className?: string
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onDuplicate?: (id: string) => void
  onRemove?: (id: string) => void
}

/**
 * IframePreview Component
 *
 * Renders blocks inside an iframe with real viewport dimensions.
 * This allows CSS media queries to respond correctly to the iframe width
 * rather than the parent window's viewport.
 *
 * Communication is handled via postMessage:
 * - Parent → Iframe: UPDATE_BLOCKS, UPDATE_SELECTION, UPDATE_THEME
 * - Iframe → Parent: READY, BLOCK_CLICKED, CONTENT_HEIGHT
 */
export function IframePreview({
  blocks,
  selectedBlockId,
  onSelectBlock,
  width = 375,
  className,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}: IframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [contentHeight, setContentHeight] = useState<number>(600)
  const { theme, resolvedTheme } = useTheme()
  const t = useTranslations('admin.builder')

  // Send message to iframe
  const sendMessage = useCallback((message: IframeMessage) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*')
    }
  }, [])

  // Handle incoming messages from iframe
  const handleMessage = useCallback((event: MessageEvent<IncomingMessage>) => {
    // Security: only accept messages from our iframe
    if (event.source !== iframeRef.current?.contentWindow) {
      return
    }

    const { type } = event.data

    switch (type) {
      case 'READY':
        setIsReady(true)
        // Send initial data once iframe is ready
        sendMessage({
          type: 'UPDATE_BLOCKS',
          blocks,
          selectedBlockId,
        })
        sendMessage({
          type: 'UPDATE_THEME',
          isDark: resolvedTheme === 'dark',
        })
        break

      case 'BLOCK_CLICKED':
        onSelectBlock(event.data.blockId)
        break

      case 'CONTENT_HEIGHT':
        setContentHeight(event.data.height)
        break

      case 'BLOCK_MOVE_UP':
        if (onMoveUp) onMoveUp(event.data.blockId)
        break

      case 'BLOCK_MOVE_DOWN':
        if (onMoveDown) onMoveDown(event.data.blockId)
        break

      case 'BLOCK_DUPLICATE':
        if (onDuplicate) onDuplicate(event.data.blockId)
        break

      case 'BLOCK_REMOVE':
        if (onRemove) onRemove(event.data.blockId)
        break
    }
  }, [blocks, selectedBlockId, resolvedTheme, onSelectBlock, onMoveUp, onMoveDown, onDuplicate, onRemove, sendMessage])

  // Listen for messages from iframe
  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  // Send blocks update when blocks change
  useEffect(() => {
    if (isReady) {
      sendMessage({
        type: 'UPDATE_BLOCKS',
        blocks,
        selectedBlockId,
      })
    }
  }, [blocks, selectedBlockId, isReady, sendMessage])

  // Send theme update when theme changes
  useEffect(() => {
    if (isReady) {
      sendMessage({
        type: 'UPDATE_THEME',
        isDark: resolvedTheme === 'dark',
      })
    }
  }, [resolvedTheme, isReady, sendMessage])

  // Send selection update when selection changes
  useEffect(() => {
    if (isReady) {
      sendMessage({
        type: 'UPDATE_SELECTION',
        selectedBlockId,
      })
    }
  }, [selectedBlockId, isReady, sendMessage])

  return (
    <div
      className={cn(
        'relative mx-auto bg-background border-x shadow-xl',
        className
      )}
      style={{ width }}
      data-cy={sel('blockEditor.previewCanvas.iframePreview.container')}
    >
      {/* Loading overlay */}
      {!isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"
          data-cy={sel('blockEditor.previewCanvas.iframePreview.loading')}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">{t('preview.loading')}</span>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src="/dashboard/preview"
        className="w-full border-0"
        style={{
          height: Math.max(contentHeight, 400),
          minHeight: 400,
        }}
        title="Mobile Preview"
        data-cy={sel('blockEditor.previewCanvas.iframePreview.frame')}
      />
    </div>
  )
}
