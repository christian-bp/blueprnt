import type { Metadata } from "next"
import type { ReactNode } from "react"

// Internal asset service: the page below is developer documentation, not
// product UI, so it stays outside the i18n pipeline (English only, like a
// README) and loads no fonts or styles beyond the system stack.
export const metadata: Metadata = {
  title: "blueprnt flags",
  description: "Country flag SVG assets for the blueprnt apps",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          margin: 0,
          padding: "3rem 1.5rem",
          maxWidth: "42rem",
          marginInline: "auto",
          lineHeight: 1.6,
        }}
      >
        {children}
      </body>
    </html>
  )
}
