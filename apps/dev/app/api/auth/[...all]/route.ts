import { auth } from "@nextsparkjs/core/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { TEAMS_CONFIG, AUTH_CONFIG } from "@nextsparkjs/core/lib/config";
import { isPublicSignupRestricted } from "@nextsparkjs/core/lib/teams/helpers";
// Registration helpers available if needed: shouldBlockSignup, isDomainAllowed
// Currently domain validation happens in auth.ts databaseHooks
import { TeamService } from "@nextsparkjs/core/lib/services";
import { wrapAuthHandlerWithCors, handleCorsPreflightRequest, addCorsHeaders } from "@nextsparkjs/core/lib/api/helpers";

const handlers = toNextJsHandler(auth);

// Handle CORS preflight requests for cross-origin auth (mobile apps, etc.)
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflightRequest(req);
}

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

  // Wrap with CORS headers for cross-origin requests (mobile apps, etc.)
  return wrapAuthHandlerWithCors(() => handlers.GET(req), req);
}

// Intercept signup requests to validate registration mode
export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Determine request type
  // Comprehensive signup endpoint detection to prevent bypasses
  const signupEndpoints = [
    '/sign-up/email',
    '/sign-up/credentials',
    '/signup',
    '/register',
  ];

  const isSignupAttempt = signupEndpoints.some(endpoint => pathname.includes(endpoint));
  const isOAuthCallback = pathname.includes('/api/auth/callback/');
  const isSignupRequest = isSignupAttempt || isOAuthCallback;

  if (isSignupRequest) {
    const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';
    const teamsMode = TEAMS_CONFIG.mode;

    // --- Registration mode enforcement ---

    // 1. Domain-restricted mode: block email signup, allow OAuth (validated in database hooks)
    if (registrationMode === 'domain-restricted' && isSignupAttempt && !isOAuthCallback) {
      // Block direct email/password signup in domain-restricted mode
      // Only Google OAuth is allowed (domain validation happens in database hooks)
      const errorResponse = NextResponse.json(
        {
          error: 'Email signup disabled',
          message: 'Please sign up with Google using an authorized email domain.',
          code: 'EMAIL_SIGNUP_DISABLED',
        },
        { status: 403 }
      );
      return await addCorsHeaders(errorResponse, req);
    }

    // Note: OAuth domain validation happens in auth.ts databaseHooks (user.create.before)
    // The hook throws an error if the email domain is not in allowedDomains

    // 2. Invitation-only mode OR single-tenant teams mode: existing behavior
    if (registrationMode === 'invitation-only' || isPublicSignupRestricted(teamsMode)) {
      const teamExists = await TeamService.hasGlobal();

      if (teamExists) {
        const errorResponse = NextResponse.json(
          {
            error: 'Registration is closed',
            message: 'This application requires an invitation to register. Please contact an administrator.',
            code: 'SIGNUP_RESTRICTED',
          },
          { status: 403 }
        );
        return await addCorsHeaders(errorResponse, req);
      }
    }
  }

  // Wrap with CORS headers for cross-origin requests (mobile apps, etc.)
  return wrapAuthHandlerWithCors(() => handlers.POST(req), req);
}