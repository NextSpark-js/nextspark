import { auth } from "@nextsparkjs/core/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { TEAMS_CONFIG, AUTH_CONFIG } from "@nextsparkjs/core/lib/config";
import { isPublicSignupRestricted } from "@nextsparkjs/core/lib/teams/helpers";
// Registration helpers available if needed: shouldBlockSignup, isDomainAllowed
// Currently domain validation happens in auth.ts databaseHooks
import { TeamService } from "@nextsparkjs/core/lib/services";
import { wrapAuthHandlerWithCors, handleCorsPreflightRequest, addCorsHeaders } from "@nextsparkjs/core/lib/api/helpers";
import { checkDistributedRateLimit } from "@nextsparkjs/core/lib/api/rate-limit";

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
  // Rate limiting: 5 requests per 15 minutes per IP (tier: auth).
  // Protects login/signup against brute-force and credential stuffing attacks.
  // IP extraction strategy:
  // - Cloudflare: cf-connecting-ip (set by Cloudflare, not spoofable behind CF)
  // - Vercel/trusted proxies: rightmost non-private IP in x-forwarded-for
  // - Fallback: x-real-ip or 'unknown'
  const clientIp = (() => {
    // Cloudflare sets this header and it cannot be spoofed when behind CF
    const cfIp = req.headers.get('cf-connecting-ip')
    if (cfIp) return cfIp

    // x-forwarded-for: use rightmost entry (last proxy-appended value is most trustworthy)
    const forwardedFor = req.headers.get('x-forwarded-for')
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean)
      if (ips.length > 0) return ips[ips.length - 1]
    }

    return req.headers.get('x-real-ip') || 'unknown'
  })()
  const rateLimitResult = await checkDistributedRateLimit(`auth:ip:${clientIp}`, 'auth')
  if (!rateLimitResult.allowed) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '900',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
      },
    })
  }

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