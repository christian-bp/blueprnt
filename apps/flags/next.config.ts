import type { NextConfig } from "next"

// Static country-flag SVG service. The assets are version-controlled and
// immutable, so they cache for a year; CORS is open since the flags are
// public images consumed cross-origin by the other apps.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/flags/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default nextConfig
