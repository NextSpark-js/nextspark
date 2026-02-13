import { auth } from "@nextsparkjs/core/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { TEAMS_CONFIG, AUTH_CONFIG } from "@nextsparkjs/core/lib/config";
import { isPublicSignupRestricted } from "@nextsparkjs/core/lib/teams/helpers";
import { shouldBlockSignup, isDomainAllowed } from "@nextsparkjs/core/lib/auth/registration-helpers";
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
  const isEmailSignup = pathname === '/api/auth/sign-up/email';
  const isOAuthCallback = pathname.includes('/api/auth/callback/');
  const isSignupRequest = isEmailSignup || isOAuthCallback;

  if (isSignupRequest) {
    const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';
    const teamsMode = TEAMS_CONFIG.mode;

    // --- Registration mode enforcement ---

    // 1. Closed mode: block ALL signup attempts
    if (shouldBlockSignup(registrationMode, isOAuthCallback)) {
      const errorResponse = NextResponse.json(
        {
          error: 'Registration is closed',
          message: 'Public registration is not available. Please contact an administrator.',
          code: 'REGISTRATION_CLOSED',
        },
        { status: 403 }
      );
      return await addCorsHeaders(errorResponse, req);
    }

    // 2. Domain-restricted mode: validate email domain on OAuth callback
    if (registrationMode === 'domain-restricted' && isOAuthCallback) {
      // We can't read the email from the OAuth callback directly here
      // because Better Auth handles the token exchange internally.
      // Domain validation for OAuth is handled in auth.ts databaseHooks (user.create.before)
      // See Phase 3b below - we add a hook in auth.ts instead.
    }

    // 3. Invitation-only mode OR single-tenant teams mode: existing behavior
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