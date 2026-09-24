import { NextRequest, NextResponse } from "next/server";
import { auth } from "@nextsparkjs/core/lib/auth";
import { withRateLimitTier } from "@nextsparkjs/core/lib/api/rate-limit";
import { UserService } from "@nextsparkjs/core/lib/services";

export const DELETE = withRateLimitTier(async (req: NextRequest) => {
  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    try {
      // Anonymize the account: scrubs user metadata, frees the UNIQUE email,
      // strips PII, and revokes every session + stored credential. A hard
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
        return NextResponse.json(
          { error: (dbError as Error).message },
          { status: 409 }
        );
      }
      console.error("Failed to delete user account:", dbError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, 'strict');
