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
  // experimental.turbopackFileSystemCacheForDev was pinned to false here to
  // stop the dev server serving stale i18n messages. It never did: measuring
  // the same edit against a running server showed the cause is the message
  // files being reached through `import()` (see i18n/request.ts), and with
  // that fixed the cache makes no difference. Removed so dev keeps Next's
  // default warm start.
  // Docs MDX is read from the filesystem at request time (locale is a
  // cookie, so these routes render dynamically); without tracing the files
  // are absent from the serverless bundle. A single "/docs" key covers BOTH
  // /docs and /docs/[slug]: outputFileTracingIncludes matches route keys with
  // picomatch's contains:true after normalizeAppPath strips the route group,
  // so "/docs" matches any traced path containing it, including
  // "/docs/[slug]". Confirmed by inspecting both routes' .nft.json after a
  // production build: each lists exactly the 280 files under content/docs.
  // Do not add a second "/docs/[slug]" key: picomatch parses "[slug]" as a
  // character class, so as its own key it would never match anything.
  // The command palette's guide index reads the same corpus from its own
  // route, so it needs its own key. "/docs" happens to be a substring of
  // "/api/docs-index" and would match it under contains:true, but only by
  // accident of the name: renaming the route would silently ship it without
  // its content.
  outputFileTracingIncludes: {
    "/docs": ["./content/docs/**/*"],
    "/api/docs-index": ["./content/docs/**/*"],
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
