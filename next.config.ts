import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  turbopack: {},
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? '').split(',').filter(Boolean),
  experimental: {
    serverActions: {
      allowedOrigins: (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    },
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      ],
    }]
  },
}

export default withPWA(nextConfig)
