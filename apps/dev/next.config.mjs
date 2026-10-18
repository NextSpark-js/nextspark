import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin('../../packages/core/src/i18n.ts');

// The app's Next.js basePath. Next.js adds it to routes and to <Link>, and to
// nothing a header names: the CSP report endpoints below are URLs the browser
// resolves against the origin, so they carry it from here.
const basePath = '';

/**
 * Silences the Node built-ins that client bundles reach transitively, and points
 * `@nextsparkjs/registries` at the generated directory.
 *
 * Only webpack reads this, and either major can build with it: Next 15 by
 * default, Next 16 with `--webpack`. Turbopack resolves `@nextsparkjs/registries`
 * through the `paths` of tsconfig.json, which Next's webpack skips for imports
 * made from inside node_modules, as core's are, and leaves a Node built-in alone
 * unless client code imports it for real.
 */
const applyWebpackFallbacks = (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      path: false,
      os: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      dns: false,
    }
  }

  // Add alias for @nextsparkjs/registries to fix ChunkLoadError
  config.resolve.alias = {
    ...config.resolve.alias,
    'pg-native': false,
    '@nextsparkjs/registries': path.resolve(__dirname, '.nextspark/registries'),
  }

  return config
}

/**
 * What the CSP allows for the analytics loaders of cookie consent (#272): the script and connect origins, and for Google
 * Analytics the image origins its pixel fallback uses. Nothing is added for a loader that is not configured. The loaders
 * read the same NEXT_PUBLIC_* variables as the defaults of `consent.loaders` in app.config; a loader set in app.config
 * only needs its origins added to the directives below by hand.
 */
const originOf = (url) => {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

const consentCspOrigins = (env = process.env) => {
  const origins = { script: [], connect: [], img: [] }
  if (env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    const plausible = originOf(env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL) ?? 'https://plausible.io'
    origins.script.push(plausible)
    origins.connect.push(plausible)
  }
  if (env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    origins.script.push('https://www.googletagmanager.com')
    origins.connect.push('https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com')
    origins.img.push('https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.googletagmanager.com')
  }
  return origins
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  // Diagnostic-only: browser source maps remain off unless explicitly requested.
  productionBrowserSourceMaps: process.env.NEXTSPARK_DIAGNOSTIC_SOURCEMAPS === '1',
  transpilePackages: ['@nextsparkjs/core', '@nextsparkjs/plugin-langchain'],
  experimental: {
    externalDir: true,
  },
  // Optimize imports from @nextsparkjs/core to reduce bundle size and improve tree-shaking
  modularizeImports: {
    '@nextsparkjs/core/components/ui': {
      transform: '@nextsparkjs/core/components/ui/{{member}}',
    },
    '@nextsparkjs/core/hooks': {
      transform: '@nextsparkjs/core/hooks/{{member}}',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // The monorepo dev app only, not a template to copy: its sample data loads these hosts. A project
    // starts from packages/core/templates/next.config.mjs, which lists exact hosts.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // Next.js sets TURBOPACK before it loads this file whenever Turbopack builds
  // (on 15 with --turbopack, on 16 unless given --webpack), and next-intl picks
  // its own webpack or Turbopack setup from the same variable.
  ...(process.env.TURBOPACK ? {} : { webpack: applyWebpackFallbacks }),
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Allowed image domains (must match remotePatterns above)
    // NOTE: Wildcard patterns (*.public.blob.vercel-storage.com, *.supabase.co, *.cloudinary.com)
    // allow images from any account on these services for development flexibility.
    // For production with stricter security, consider restricting to specific account subdomains.
    const allowedImageDomains = [
      'https://lh3.googleusercontent.com',
      'https://*.public.blob.vercel-storage.com',
      'https://images.unsplash.com',
      'https://upload.wikimedia.org',
      'https://i.pravatar.cc',
      'https://*.supabase.co',
      'https://*.cloudinary.com',
    ].join(' ');

    // CSP directives
    // Note: 'unsafe-inline' for styles is required by many UI libraries including shadcn/ui
    // Note: 'unsafe-eval' is required by Next.js in development for hot reload
    //
    // SECURITY NOTE: 'unsafe-inline' for scripts
    // ==========================================
    // 'unsafe-inline' is required because:
    // 1. Next.js injects inline scripts for hydration and routing
    // 2. Many React patterns rely on inline event handlers
    // 3. Implementing nonces requires middleware changes and affects all components
    //
    // To implement nonce-based CSP (stricter security):
    // 1. Create middleware to generate nonce per request
    // 2. Pass nonce to all Script components: <Script nonce={nonce} />
    // 3. Update CSP: script-src 'self' 'nonce-${nonce}'
    // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
    const consent = consentCspOrigins()
    const withConsent = (list) => list.map((origin) => ` ${origin}`).join('')
    const cspDirectives = [
      "default-src 'self'",
      // unsafe-inline required for Next.js hydration; unsafe-eval only in dev for hot reload
      `script-src 'self' 'unsafe-inline'${!isProduction ? " 'unsafe-eval'" : ''} https://js.stripe.com${withConsent(consent.script)}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${allowedImageDomains}${withConsent(consent.img)}`,
      "font-src 'self' data:",
      // wss: needed for Next.js hot reload in development
      `connect-src 'self' https://api.stripe.com${!isProduction ? ' wss:' : ''}${withConsent(consent.connect)}`,
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      // Allow embedding in iframes from same origin (needed for page builder preview)
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      // CSP violation reporting - sends violations to /api/csp-report
      // report-uri is deprecated but has wider browser support
      // report-to is the modern replacement (configured via Reporting-Endpoints header)
      `report-uri ${basePath}/api/csp-report`,
      "report-to csp-endpoint",
    ];

    // Security headers for all routes
    const securityHeaders = [
      // Reporting API endpoint for modern browsers (used by report-to CSP directive)
      {
        key: 'Reporting-Endpoints',
        value: `csp-endpoint="${basePath}/api/csp-report"`
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        // SAMEORIGIN allows same-origin iframes (needed for page builder preview)
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      // X-XSS-Protection is deprecated but kept for legacy browser support
      // Modern browsers use CSP instead
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()'
      },
      {
        key: 'Content-Security-Policy',
        value: cspDirectives.join('; ')
      },
    ];

    // Add HSTS only in production
    // Note: Only add 'preload' if you plan to submit to https://hstspreload.org
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      });
    }

    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: securityHeaders
      },
      // No CORS headers here: core's API routes answer CORS per request (addCorsHeaders), so the
      // origins in api.cors.allowedOrigins and CORS_ADDITIONAL_ORIGINS get their grant in production too
    ]
  },
}

export default withNextIntl(nextConfig)
