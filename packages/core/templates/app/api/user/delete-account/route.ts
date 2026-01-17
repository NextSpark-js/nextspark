import { NextRequest, NextResponse } from "next/server";
import { auth } from "@nextsparkjs/core/lib/auth";
import { mutateWithRLS } from "@nextsparkjs/core/lib/db";
import { withRateLimitTier } from "@nextsparkjs/core/lib/api/rate-limit";

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
      // Sign out the user first (while the user still exists)
      try {
        await auth.api.signOut({
          headers: req.headers,
        });
      } catch (signOutError) {
        console.warn("Sign out failed (user may already be signed out):", signOutError);
      }

      // Delete user account and all associated data
      // RLS policies will ensure only the user's own data is deleted
      await mutateWithRLS(
        'DELETE FROM "users" WHERE id = $1',
        [userId],
        userId
      );

      return NextResponse.json({ 
        message: "Account deleted successfully" 
      });

    } catch (dbError) {
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
