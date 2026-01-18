import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin('../../packages/core/src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@nextsparkjs/core'],
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
    ],
  },
  webpack: (config, { isServer }) => {
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
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Allowed image domains (must match remotePatterns above)
    const allowedImageDomains = [
      'https://lh3.googleusercontent.com',
      'https://*.public.blob.vercel-storage.com',
      'https://images.unsplash.com',
      'https://upload.wikimedia.org',
      'https://i.pravatar.cc',
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
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // CSP violation reporting - sends violations to /api/csp-report
      // report-uri is deprecated but has wider browser support
      // report-to is the modern replacement (configured via Reporting-Endpoints header)
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ];

    // Security headers for all routes
    const securityHeaders = [
      // Reporting API endpoint for modern browsers (used by report-to CSP directive)
      {
        key: 'Reporting-Endpoints',
        value: 'csp-endpoint="/api/csp-report"'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY'
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
      // CORS headers for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, x-verify-from-ui, Cookie, Set-Cookie'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Set-Cookie'
          }
        ]
      }
    ]
  },
}

export default withNextIntl(nextConfig)
