'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { FileNode } from '@/lib/types'

interface FileTreeProps {
  files: FileNode[]
  selectedPath: string | null
  onSelectFile: (path: string) => void
  isLoading?: boolean
  hasProject?: boolean
}

const EXT_COLORS: Record<string, string> = {
  '.ts': 'text-blue-400',
  '.tsx': 'text-blue-400',
  '.js': 'text-yellow-400',
  '.jsx': 'text-yellow-400',
  '.css': 'text-pink-400',
  '.json': 'text-yellow-300/70',
  '.md': 'text-text-secondary',
  '.env': 'text-green-400/70',
  '.mjs': 'text-yellow-400',
  '.mts': 'text-blue-400',
}

function getFileColor(name: string): string {
  const ext = name.slice(name.lastIndexOf('.'))
  return EXT_COLORS[ext] || 'text-text-muted'
}

function countFiles(nodes: FileNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'file') count++
    if (node.children) count += countFiles(node.children)
  }
  return count
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelectFile: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDir = node.type === 'directory'
  const isSelected = node.path === selectedPath

  const handleClick = useCallback(() => {
    if (isDir) {
      setExpanded((prev) => !prev)
    } else {
      onSelectFile(node.path)
    }
  }, [isDir, node.path, onSelectFile])

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-1 py-[3px] text-left text-[11px] transition-colors hover:bg-bg-hover/60 ${
          isSelected
            ? 'bg-accent-muted text-accent'
            : 'text-text-secondary'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-text-muted/50" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-text-muted/50" />
            )}
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-accent/70" />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-shrink-0 text-accent/50" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <File className={`h-3 w-3 flex-shrink-0 ${getFileColor(node.name)}`} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ files, selectedPath, onSelectFile, isLoading, hasProject }: FileTreeProps) {
  const fileCount = useMemo(() => countFiles(files), [files])

  // Loading state — project ready but files still fetching
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        <p className="text-[11px] text-text-muted">Fetching files...</p>
      </div>
    )
  }

  // No project yet
  if (!hasProject) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-[11px] text-text-muted/50">Files will appear here</p>
      </div>
    )
  }

  // Project exists but no files
  if (files.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-[11px] text-text-muted/50">No files found</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto py-1">
      {files.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}

export { countFiles }
