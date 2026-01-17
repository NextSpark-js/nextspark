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

    // Security headers for all routes
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY'
      },
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
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://api.stripe.com wss:",
          "frame-src https://js.stripe.com https://hooks.stripe.com",
          "frame-ancestors 'none'",
        ].join('; ')
      },
    ];

    // Add HSTS only in production
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains'
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
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
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
