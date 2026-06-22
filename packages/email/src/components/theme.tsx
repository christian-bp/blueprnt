import {
  Font,
  Head,
  Html,
  pixelBasedPreset,
  Tailwind,
} from "@react-email/components"
import type React from "react"

// Email color tokens, mirrored from the app theme (packages/ui globals.css).
// `brand` is the sRGB of --brand (oklch(0.6289 0.2079 15.74)); `brandForeground`
// is --brand-foreground. Email needs hex, not oklch.
export const colors = {
  background: "#ffffff",
  text: "#171717",
  muted: "#737373",
  border: "#e5e5e5",
  brand: "#eb3e5d",
  brandForeground: "#fafafa",
} as const

export const FONT_FAMILY =
  '"Source Sans 3", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Source Sans 3 latin subset (v19). The variable woff2 serves both weights; most
// clients ignore web fonts and use the fallback stack, which is the real target.
const SOURCE_SANS_3_WOFF2 =
  "https://fonts.gstatic.com/s/sourcesans3/v19/nwpStKy2OAdR1K-IwhWudF-R3w8aZejf5Hc.woff2"

export const LOGO_PATH = "/email/blueprnt-wordmark.png"

// Same origin the backend uses for action links (SITE_URL / requireSiteUrl),
// so the logo host always matches the link host. Read at render time inside the
// Convex action (process.env is available there) with a production default.
export function logoUrl(): string {
  return `${process.env.SITE_URL ?? "https://app.blueprnt.se"}${LOGO_PATH}`
}

export function EmailThemeProvider({
  lang,
  preview,
  children,
}: {
  lang: string
  preview?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Html lang={lang}>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head>
          <Font
            fontFamily="Source Sans 3"
            fallbackFontFamily="Helvetica"
            webFont={{ url: SOURCE_SANS_3_WOFF2, format: "woff2" }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Source Sans 3"
            fallbackFontFamily="Helvetica"
            webFont={{ url: SOURCE_SANS_3_WOFF2, format: "woff2" }}
            fontWeight={600}
            fontStyle="normal"
          />
        </Head>
        {preview}
        {children}
      </Tailwind>
    </Html>
  )
}
