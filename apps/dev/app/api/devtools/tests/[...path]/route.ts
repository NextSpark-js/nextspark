import { getTypedSession } from "@nextsparkjs/core/lib/auth";
import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

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
    const session = await getTypedSession(request.headers);

    if (!session?.user || session.user.role !== "developer") => {
      return NextResponse.json(
        {
          success: false,
          error: "Developer access required",
        },
        { status: 403 }
      );
    }

    // Await params in Next.js 15
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;

    if (!pathSegments || pathSegments.length === 0) => {
      return NextResponse.json(
        {
          success: false,
          error: "Path is required",
        },
        { status: 400 }
      );
    }

    // Security: Prevent path traversal attacks
    const hasTraversal = pathSegments.some(
      (segment) => segment.includes("..") || segment.includes("/")
    );
    if (hasTraversal) => {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid path",
        },
        { status: 400 }
      );
    }

    // Get active theme from environment
    const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || "default";

    // Build file path
    const filePath = join(
      process.cwd(),
      "contents",
      "themes",
      activeTheme,
      "tests",
      "cypress",
      "e2e",
      ...pathSegments
    );

    // Verify file exists and is a file
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) => {
        return NextResponse.json(
          {
            success: false,
            error: "Path is not a file",
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "File not found",
        },
        { status: 404 }
      );
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
          theme: activeTheme,
        },
      },
      { status: 200 }
    );
  } catch (error) => {
    console.error("[API] /api/devtools/tests/[...path] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === "production"
          ? "Failed to load test file"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}, 'read');
