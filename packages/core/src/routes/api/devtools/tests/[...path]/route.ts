import { getAuthorizationSession } from "@nextsparkjs/core/lib/auth/authorization-session";
import { NextResponse } from "next/server";
import { createApiError } from '@nextsparkjs/core/lib/api/helpers';
import { readFile, stat } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response';

/**
 * GET /api/devtools/tests/[...path]
 *
 * Returns content of a specific test documentation file
 * Only accessible to developer role
 *
 * @param path - Array of path segments (e.g., ['auth', 'login.md'])
 */
export const GET = withRateLimitTier(async (
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  try {
    // Verify developer role
    const session = await getAuthorizationSession(request.headers);

    if (!session?.user || session.user.role !== "developer") {
      return createApiError("Developer access required", 403, undefined, 'FORBIDDEN');
    }

    // Await params in Next.js 15
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;

    if (!pathSegments || pathSegments.length === 0) {
      return createApiError("Path is required", 400, undefined, 'VALIDATION_ERROR');
    }

    // Security: Prevent path traversal attacks
    const hasTraversal = pathSegments.some(
      (segment) => segment.includes("..") || segment.includes("/")
    );
    if (hasTraversal) {
      return createApiError("Invalid path", 400, undefined, 'VALIDATION_ERROR');
    }

    const filePath = join(
      process.cwd(),
      "tests",
      "cypress",
      "e2e",
      ...pathSegments
    );

    // Verify file exists and is a file
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        return createApiError("Path is not a file", 400, undefined, 'VALIDATION_ERROR');
      }
    } catch {
      return createApiError("File not found", 404, undefined, 'NOT_FOUND');
    }

    // Read file content
    const fileContent = await readFile(filePath, "utf-8");

    // Parse frontmatter if exists
    const { data: frontmatter, content } = matter(fileContent);

    return NextResponse.json(
      {
        success: true,
        data: {
          path: pathSegments.join("/"),
          content,
          frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
          project: "default",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] /api/devtools/tests/[...path] error:", error);
    return createApiError("Failed to load test file", 500, undefined, 'INTERNAL_ERROR');
  }
}, 'read');

export const OPTIONS = corsPreflight;
