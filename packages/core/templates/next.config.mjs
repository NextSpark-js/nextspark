import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For npm mode, use local i18n.ts that re-exports from @nextsparkjs/core
const withNextIntl = createNextIntlPlugin('./i18n.ts');

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
 * A visitor with no session cookie at all is sent to login before /superadmin and
 * /devtools render, with a 307. With Cache Components a page's prerendered shell
 * goes out with a 200 before core's server-side role check runs, so without this
 * the refusal would be a client-side redirect. It only looks at whether a cookie
 * is there: a signed-in user without the role still reaches core's check (and
 * src/proxy.ts), which decides. Better Auth names the cookie with the __Secure-
 * prefix over HTTPS and without it over HTTP; `missing` applies only when every
 * item is missing. Next.js adds basePath to source and destination; callbackUrl
 * is the path inside the app, as the proxy writes it.
 */
const SESSION_COOKIES = ['__Secure-better-auth.session_token', 'better-auth.session_token']
const ROLE_GATED_AREAS = ['superadmin', 'devtools']

const roleGatedAreaRedirects = () => {
  const missing = SESSION_COOKIES.map((key) => ({ type: 'cookie', key }))
  return ROLE_GATED_AREAS.flatMap((area) => [
    { source: `/${area}`, destination: `/login?callbackUrl=/${area}`, permanent: false, missing },
    { source: `/${area}/:path*`, destination: `/login?callbackUrl=/${area}/:path*`, permanent: false, missing },
  ])
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  // Cache Components + PPR is the default rendering mode. For legacy ISR, remove this line or set it to false.
  cacheComponents: true,
  // `next dev` under an AI agent would append its agent-rules block to the tracked AGENTS.md (Next 16.3+); the project's
  // own AGENTS.md is the guidance, and the tree stays clean
  agentRules: false,
  transpilePackages: ['@nextsparkjs/core'],
  serverExternalPackages: ['handlebars'],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    externalDir: true,
  },
  // Include markdown files in Vercel deployment for dynamic file reads
  // Required because fs.readFileSync() reads are not automatically traced
  outputFileTracingIncludes: {
    '/docs/**/*': ['./docs/**/*', './plugins/*/docs/**/*'],
    '/superadmin/docs/**/*': ['./docs/**/*', './plugins/*/docs/**/*'],
    '/devtools/tests/**/*': ['./tests/**/*', './plugins/*/tests/**/*'],
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
    // Hosts the server may fetch and resize through /_next/image.
    // Keep this list to the exact hosts you use.
    remotePatterns: [
      // Google profile pictures shown for accounts that sign in with Google.
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      // Examples: add the exact host of your own store, e.g. your Vercel Blob store
      // (`<store-id>.public.blob.vercel-storage.com`) once uploads use it.
      // { protocol: 'https', hostname: '<store-id>.public.blob.vercel-storage.com', pathname: '/**' },
      // { protocol: 'https', hostname: '<project-ref>.supabase.co', pathname: '/**' },
      // { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/<cloud-name>/**' },
      // { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
  // Next.js sets TURBOPACK before it loads this file whenever Turbopack builds
  // (on 15 with --turbopack, on 16 unless given --webpack), and next-intl picks
  // its own webpack or Turbopack setup from the same variable.
  ...(process.env.TURBOPACK ? {} : { webpack: applyWebpackFallbacks }),
  // Add the project's own redirects after these.
  async redirects() {
    return [...roleGatedAreaRedirects()]
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Image hosts the browser may load directly (CSP img-src). The server only fetches the hosts in
    // images.remotePatterns above; add a host there too when next/image should serve it.
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
    const cspDirectives = [
      "default-src 'self'",
      // unsafe-inline required for Next.js hydration; unsafe-eval only in dev for hot reload
      `script-src 'self' 'unsafe-inline'${!isProduction ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${allowedImageDomains}`,
      "font-src 'self' data:",
      // wss: needed for Next.js hot reload in development
      `connect-src 'self' https://api.stripe.com${!isProduction ? ' wss:' : ''}`,
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
