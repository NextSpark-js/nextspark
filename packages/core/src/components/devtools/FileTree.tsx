"use client";

import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";
import { cn } from '../../lib/utils';

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string;
  expandedFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  level?: number;
}

/**
 * FileTree Component
 *
 * Recursive component for displaying a hierarchical file/folder structure.
 * Uses controlled state for folder expansion (managed by parent).
 *
 * Features:
 * - Expandable/collapsible folders (controlled)
 * - Active state highlighting for selected file
 * - Visual highlight for folders in the selection path
 * - Icon differentiation (folder vs file)
 * - Deep linking support via URL
 */
export function FileTree({
  nodes,
  selectedPath,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
  level = 0,
}: FileTreeProps) {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  // Check if a folder is in the path to the selected file
  const isFolderInSelectionPath = (folderPath: string): boolean => {
    if (!selectedPath) return false;
    return selectedPath.startsWith(folderPath + "/");
  };

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedPath === node.path;
        const isInPath = isFolderInSelectionPath(node.path);
        const paddingLeft = level * 12 + 8;

        if (node.type === "folder") {
          return (
            <div key={node.path}>
              <button
                onClick={() => onToggleFolder(node.path)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left",
                  "text-sm",
                  isInPath && "bg-violet-50 dark:bg-violet-950/30"
                )}
                style={{ paddingLeft: `${paddingLeft}px` }}
                data-cy={`dev-tests-folder-${node.name}`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <Folder
                  className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isInPath
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-violet-600 dark:text-violet-400"
                  )}
                />
                <span
                  className={cn("font-medium", isInPath && "text-violet-700 dark:text-violet-300")}
                >
                  {node.name}
                </span>
              </button>
              {isExpanded && node.children && (
                <FileTree
                  nodes={node.children}
                  selectedPath={selectedPath}
                  expandedFolders={expandedFolders}
                  onSelectFile={onSelectFile}
                  onToggleFolder={onToggleFolder}
                  level={level + 1}
                />
              )}
            </div>
          );
        }

        return (
          <button
            key={node.path}
            onClick={() => onSelectFile(node.path)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left",
              "text-sm hover:bg-accent",
              isSelected &&
                "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
            )}
            style={{ paddingLeft: `${paddingLeft + 20}px` }}
            data-cy={`dev-tests-file-${node.name.replace(".md", "")}`}
          >
            <File className="h-4 w-4 flex-shrink-0" />
            <span>{node.name}</span>
          </button>
        );
      })}
    </div>
  );
}
