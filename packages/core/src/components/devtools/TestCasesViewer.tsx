"use client";

import { useState, useEffect, useMemo } from "react";
import { FileTree, FileTreeNode } from "./FileTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { BDDTestViewer } from "./bdd";
import { cn } from '../../lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Loader2, FileText, AlertCircle, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTreeNavigation } from '../../hooks/useTreeNavigation';

interface TestFileContent {
  path: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

interface TestCasesViewerProps {
  /** Initial path from URL (e.g., 'auth/login.bdd.md') */
  initialPath?: string | null;
}

/**
 * Helper function to check if a path exists in the tree
 */
function pathExistsInTree(tree: FileTreeNode[], path: string): boolean {
  for (const node of tree) {
    if (node.path === path) {
      return true;
    }
    if (node.children && pathExistsInTree(node.children, path)) {
      return true;
    }
  }
  return false;
}

/**
 * TestCasesViewer Component
 *
 * Main component for browsing and viewing test case documentation.
 * Features:
 * - File tree navigation on the left
 * - Markdown content viewer on the right
 * - URL synchronization (shareable links)
 * - Auto-expand folders to selected file
 * - Loading and error states
 * - 404 state for invalid paths
 */
export function TestCasesViewer({ initialPath }: TestCasesViewerProps) {
  const t = useTranslations("devtools.tests");
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [fileContent, setFileContent] = useState<TestFileContent | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use tree navigation hook for URL synchronization
  const {
    selectedPath,
    expandedFolders,
    navigateToFile,
    toggleFolder,
    clearSelection,
  } = useTreeNavigation({ basePath: "/devtools/tests" });

  // Check if the selected path exists in the tree (for 404 detection)
  const pathNotFound = useMemo(() => {
    if (!selectedPath || isLoadingTree || tree.length === 0) return false;
    return !pathExistsInTree(tree, selectedPath);
  }, [selectedPath, tree, isLoadingTree]);

  // Load file tree on mount
  useEffect(() => {
    async function loadTree() {
      try {
        setIsLoadingTree(true);
        const response = await fetch("/api/devtools/tests");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load test files");
        }

        setTree(data.data.tree || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load test files");
      } finally {
        setIsLoadingTree(false);
      }
    }

    loadTree();
  }, []);

  // Load file content when selectedPath changes (and path exists)
  useEffect(() => {
    if (!selectedPath || pathNotFound) {
      setFileContent(null);
      return;
    }

    async function loadFile() {
      setIsLoadingFile(true);
      setError(null);

      try {
        const response = await fetch(`/api/devtools/tests/${selectedPath}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load file");
        }

        setFileContent(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
        setFileContent(null);
      } finally {
        setIsLoadingFile(false);
      }
    }

    loadFile();
  }, [selectedPath, pathNotFound]);

  if (isLoadingTree) {
    return (
      <div className="flex items-center justify-center h-96" data-cy="devtools-tests-loading">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]"
      data-cy="devtools-tests-viewer"
    >
      {/* File Tree Sidebar */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              {t("fileTree")}
            </CardTitle>
            <CardDescription>{t("fileTreeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-5rem)]" data-cy="devtools-tests-tree">
            {tree.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">{t("noTests")}</p>
              </div>
            ) : (
              <FileTree
                nodes={tree}
                selectedPath={selectedPath || undefined}
                expandedFolders={expandedFolders}
                onSelectFile={navigateToFile}
                onToggleFolder={toggleFolder}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Viewer */}
      <div className="lg:col-span-9">
        <Card className="h-full">
          <CardContent className={cn(
            "p-6 h-full",
            // BDD viewer handles its own scrolling, others need overflow
            selectedPath?.endsWith('.bdd.md') ? "" : "overflow-y-auto"
          )}>
            {/* File Not Found State */}
            {pathNotFound && (
              <div
                className="flex flex-col items-center justify-center h-full text-center"
                data-cy="devtools-tests-not-found"
              >
                <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
                <p className="text-lg font-medium text-amber-600 dark:text-amber-400">
                  {t("fileNotFound")}
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  {t("fileNotFoundDescription", { path: selectedPath || "" })}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearSelection}
                  data-cy="devtools-tests-back-to-list"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("backToList")}
                </Button>
              </div>
            )}

            {/* Empty State (no selection) */}
            {!selectedPath && !pathNotFound && (
              <div
                className="flex flex-col items-center justify-center h-full text-center"
                data-cy="devtools-tests-empty-state"
              >
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  {t("selectFile")}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("selectFileDescription")}
                </p>
              </div>
            )}

            {/* Loading State */}
            {isLoadingFile && !pathNotFound && (
              <div
                className="flex items-center justify-center h-full"
                data-cy="devtools-tests-file-loading"
              >
                <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
              </div>
            )}

            {/* Error State */}
            {error && !pathNotFound && (
              <div
                className="flex flex-col items-center justify-center h-full text-center"
                data-cy="devtools-tests-error"
              >
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <p className="text-lg font-medium text-destructive">{t("error")}</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
              </div>
            )}

            {/* File Content */}
            {!isLoadingFile && !error && !pathNotFound && fileContent && (
              <div data-cy="devtools-tests-content">
                {/* Use BDDTestViewer for .bdd.md files */}
                {selectedPath?.endsWith('.bdd.md') ? (
                  <BDDTestViewer content={fileContent.content} />
                ) : (
                  <>
                    {(() => {
                      const frontmatter = fileContent.frontmatter as
                        | Record<string, unknown>
                        | undefined;
                      const title = frontmatter?.title;
                      if (title && typeof title === "string") {
                        return (
                          <div className="mb-6 pb-4 border-b border-border">
                            <h1 className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                              {title}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">{selectedPath}</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <MarkdownViewer content={fileContent.content} />
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
