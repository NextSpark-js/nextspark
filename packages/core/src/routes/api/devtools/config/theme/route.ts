import { getTypedSession } from "@nextsparkjs/core/lib/auth";
import { NextResponse } from "next/server";
import { ThemeService } from "@nextsparkjs/core/lib/services/theme.service";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

/**
 * GET /api/devtools/config/theme
 *
 * Returns current theme configuration
 * Only accessible to developer role
 */
export const GET = withRateLimitTier(async (request: Request) => {
  try {
    // Verify developer role
    const session = await getTypedSession(request.headers);

    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        {
          success: false,
          error: "Developer access required",
        },
        { status: 403 }
      );
    }

    const projectName = ThemeService.getCurrentName();
    const themeConfig = ThemeService.getCurrentAppConfig();

    if (!themeConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Project configuration not found for: ${projectName}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          theme: projectName,
          config: themeConfig,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] /api/devtools/config/theme error:", error);
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === "production"
          ? "Failed to load theme configuration"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}, 'read');
