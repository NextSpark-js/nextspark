import { getAuthorizationSession } from "@nextsparkjs/core/lib/auth/authorization-session";
import { NextResponse } from "next/server";
import { createApiError } from '@nextsparkjs/core/lib/api/helpers';
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response';

/**
 * File tree node structure
 */
interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

/**
 * Recursively build file tree structure
 */
async function buildFileTree(dirPath: string, basePath: string): Promise<FileTreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const tree: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = fullPath.replace(basePath + "/", "");

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const children = await buildFileTree(fullPath, basePath);
      tree.push({
        name: entry.name,
        path: relativePath,
        type: "folder",
        children,
      });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      // Only include .md files
      tree.push({
        name: entry.name,
        path: relativePath,
        type: "file",
      });
    }
  }

  // Sort: folders first, then files, both alphabetically
  return tree.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "folder" ? -1 : 1;
  });
}

/**
 * GET /api/devtools/tests
 *
 * Returns file tree structure of test documentation files
 * Only accessible to developer role
 */
export const GET = withRateLimitTier(async (request: Request) => {
  try {
    // Verify developer role
    const session = await getAuthorizationSession(request.headers);

    if (!session?.user || session.user.role !== "developer") {
      return createApiError("Developer access required", 403, undefined, 'FORBIDDEN');
    }

    const testsBasePath = join(
      process.cwd(),
      "tests",
      "cypress",
      "e2e"
    );

    // Check if directory exists
    try {
      await stat(testsBasePath);
    } catch {
      return NextResponse.json(
        {
          success: true,
          data: {
            tree: [],
            message: "No test files found",
          },
        },
        { status: 200 }
      );
    }

    // Build file tree
    const tree = await buildFileTree(testsBasePath, testsBasePath);

    return NextResponse.json(
      {
        success: true,
        data: {
          tree,
          basePath: testsBasePath,
          project: "default",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] /api/devtools/tests error:", error);
    return createApiError("Failed to load test files", 500, undefined, 'INTERNAL_ERROR');
  }
}, 'read');

export const OPTIONS = corsPreflight;
