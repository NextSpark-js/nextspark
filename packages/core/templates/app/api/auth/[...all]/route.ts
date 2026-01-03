import { auth } from "@nextsparkjs/core/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { TEAMS_CONFIG } from "@nextsparkjs/core/lib/config";
import { isPublicSignupRestricted } from "@nextsparkjs/core/lib/teams/helpers";
import { TeamService } from "@nextsparkjs/core/lib/services";

const handlers = toNextJsHandler(auth);

// Intercept email verification requests to redirect to UI page
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest, context: { params: Promise<{ all: string[] }> }) {
  const pathname = req.nextUrl.pathname;

  // Check if this is an email verification request from an email link
  // We check for a special header to determine if it's from our UI or from an email click
  const isFromUI = req.headers.get('x-verify-from-ui') === 'true';

  if (pathname === '/api/auth/verify-email' && !isFromUI) {
    const token = req.nextUrl.searchParams.get('token');
    const callbackURL = req.nextUrl.searchParams.get('callbackURL');

    if (token) {
      // This is from an email link, redirect to the UI verification page
      const redirectUrl = new URL('/verify-email', req.url);
      redirectUrl.searchParams.set('token', token);
      if (callbackURL) {
        redirectUrl.searchParams.set('callbackURL', callbackURL);
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  // For all other requests (including UI verification calls), use the default Better Auth handler
  return handlers.GET(req);
}

// Intercept signup requests to validate single-tenant mode
export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check if this is a signup request (email or OAuth)
  const isSignupRequest =
    pathname === '/api/auth/sign-up/email' ||
    pathname.includes('/api/auth/callback/'); // OAuth callbacks can create users

  if (isSignupRequest) {
    const teamsMode = TEAMS_CONFIG.mode;

    // In single-tenant mode, block public signup if team already exists
    if (isPublicSignupRestricted(teamsMode)) {
      const teamExists = await TeamService.hasGlobal();

      if (teamExists) {
        // Block public signup - users must be invited
        return NextResponse.json(
          {
            error: 'Registration is closed',
            message: 'This application requires an invitation to register. Please contact an administrator.',
            code: 'SIGNUP_RESTRICTED',
          },
          { status: 403 }
        );
      }
    }
  }

  // Continue with normal Better Auth handling
  return handlers.POST(req);
}