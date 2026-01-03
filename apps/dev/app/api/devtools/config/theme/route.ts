import { auth } from "@nextsparkjs/core/lib/auth";
import { NextResponse } from "next/server";
import { ThemeService } from "@nextsparkjs/core/lib/services/theme.service";

/**
 * GET /api/devtools/config/theme
 *
 * Returns current theme configuration
 * Only accessible to developer role
 */
export async function GET(request: Request) {
  try {
    // Verify developer role
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        {
          success: false,
          error: "Developer access required",
        },
        { status: 403 }
      );
    }

    // Get active theme from environment
    const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || "default";

    // Get theme configuration from registry
    const themeConfig = ThemeService.getAppConfig(activeTheme);

    if (!themeConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Theme configuration not found for theme: ${activeTheme}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          theme: activeTheme,
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
}
