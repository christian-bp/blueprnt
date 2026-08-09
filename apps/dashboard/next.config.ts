import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const isDev = process.env.NODE_ENV === "development"

// Convex serves the HTTP API over https and the reactive sync over wss on the
// same origin. Derive both from NEXT_PUBLIC_CONVEX_URL so connect-src stays
// correct across dev, preview, and prod Convex deployments. The browser reaches
// the auth backend only via the same-origin /api/auth proxy, so .convex.site is
// intentionally NOT listed here.
const convexHttpUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
const convexWsUrl = convexHttpUrl
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:")

const cspReportOnly = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for its bootstrap unless we move to a
  // nonce-based CSP in proxy.ts (a flagged follow-up). 'unsafe-eval' is only
  // needed by React in development.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${convexHttpUrl} ${convexWsUrl}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ")

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
]

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/backend", "@workspace/i18n", "@workspace/ui"],
  experimental: {
    // Turbopack's persistent dev cache (default since Next 16.1) keeps its
    // compilation under .next/dev/cache/turbopack across runs. With it on,
    // an edit to a message file in packages/i18n never reaches the RUNNING
    // dev server: Turbopack emits a fresh chunk containing the new key
    // within a second, but the server keeps serving a bundle without it, so
    // every new string renders as its raw key until the server is
    // restarted. Measured: the emitted chunk had the key, and a
    // cache-bypassing fetch of the page showed the server's own serialized
    // messages did not.
    //
    // Off until that invalidation is trustworthy. The cost is a colder
    // start; the cost of leaving it on is that no message edit is visible
    // without a restart.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
