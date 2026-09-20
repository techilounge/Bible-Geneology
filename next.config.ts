import type { NextConfig } from 'next';
import { buildCsp, originOf } from './lib/security/csp';

/**
 * The headers every response carries.
 *
 * The content security policy is built here rather than in middleware
 * because it has to apply to prerendered responses too, and because
 * this site's policy is the same for every request — see
 * lib/security/csp.ts for why it carries no nonce.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Superseded by frame-ancestors for modern browsers, kept for the rest.
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: buildCsp({
      development: process.env.NODE_ENV === 'development',
      supabaseOrigin: originOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
    }),
  },
  // Two years, subdomains included. Ignored over http, which is why it
  // costs nothing locally and matters as soon as there is a domain.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The framework's version header says what to look up a CVE for.
  poweredByHeader: false,
  // Type errors and lint failures fail the build. Requirement section 64
  // forbids disabling either to get a build through.
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
