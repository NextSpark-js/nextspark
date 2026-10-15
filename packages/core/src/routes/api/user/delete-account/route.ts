import { NextRequest, NextResponse } from "next/server";
import { createApiError } from '@nextsparkjs/core/lib/api/error-response';
import { auth } from "@nextsparkjs/core/lib/auth";
import { getAuthorizationSession } from "@nextsparkjs/core/lib/auth/authorization-session";
import { withRateLimitTier } from "@nextsparkjs/core/lib/api/rate-limit";
import { corsPreflight } from "@nextsparkjs/core/lib/api/cors-response";
import { UserService } from "@nextsparkjs/core/lib/services";

export const DELETE = withRateLimitTier(async (req: NextRequest) => {
  try {
    // Get session from Better Auth
    const session = await getAuthorizationSession(req.headers);

    if (!session?.user) {
      return createApiError("Unauthorized", 401, undefined, 'AUTHENTICATION_REQUIRED');
    }

    const userId = session.user.id;

    try {
      // Anonymize the account: scrubs user metadata, frees the UNIQUE email,
      // strips PII, revokes every session + stored credential, deactivates the
      // user's API keys and removes their team memberships. A hard
      // DELETE fails under foreign-key constraints; anonymizing preserves
      // referential integrity. Throws code 'OWNS_TEAMS' if the user still
      // owns teams (ownership must be transferred or those teams deleted first).
      await UserService.anonymizeAccount(userId);

      // Sessions are already revoked server-side; clear the current session
      // cookie on this device too.
      try {
        await auth.api.signOut({ headers: req.headers });
      } catch (signOutError) {
        console.warn("Sign out after account deletion failed (already revoked):", signOutError);
      }

      return NextResponse.json({
        message: "Account deleted successfully",
      });
    } catch (dbError) {
      if ((dbError as { code?: string })?.code === "OWNS_TEAMS") {
        return createApiError((dbError as Error).message, 409, undefined, 'CONFLICT');
      }
      console.error("Failed to delete user account:", dbError);
      return createApiError("Failed to delete account", 500, undefined, 'INTERNAL_ERROR');
    }
  } catch (error) {
    console.error("Delete account error:", error);
    return createApiError("Internal server error", 500, undefined, 'INTERNAL_ERROR');
  }
}, 'strict');

export const OPTIONS = corsPreflight;
