import { getAuthorizationSession } from "@nextsparkjs/core/lib/auth/authorization-session";
import { NextResponse } from "next/server";
import { createApiError } from '@nextsparkjs/core/lib/api/error-response';
import { ThemeService } from "@nextsparkjs/core/lib/services/theme.service";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response';

/**
 * GET /api/devtools/config/theme
 *
 * Returns current theme configuration
 * Only accessible to developer role
 */
export const GET = withRateLimitTier(async (request: Request) => {
  try {
    // Verify developer role
    const session = await getAuthorizationSession(request.headers);

    if (!session?.user || session.user.role !== "developer") {
      return createApiError("Developer access required", 403, undefined, 'FORBIDDEN');
    }

    const projectName = ThemeService.getCurrentName();
    const themeConfig = ThemeService.getCurrentAppConfig();

    if (!themeConfig) {
      return createApiError(`Project configuration not found for: ${projectName}`, 404, undefined, 'NOT_FOUND');
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
    return createApiError("Failed to load theme configuration", 500, undefined, 'INTERNAL_ERROR');
  }
}, 'read');

export const OPTIONS = corsPreflight;
