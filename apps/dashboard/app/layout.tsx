import "@workspace/ui/globals.css"

import { cn } from "@workspace/ui/lib/utils"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { Geist_Mono, Inter, Lora } from "next/font/google"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"

// Same fonts and variable names as apps/web: the shared globals.css maps
// font-sans/font-heading/font-mono to these runtime variables.
const loraHeading = Lora({ subsets: ["latin"], variable: "--font-heading" })
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default async function RootLayout(props: { children: ReactNode }) {
  const locale = await getLocale()
  // An unreachable or misconfigured Convex deployment must degrade to the
  // signed-out shell, never crash the layout.
  let token: string | null = null
  try {
    token = (await getToken()) ?? null
  } catch {
    token = null
  }
  return (
    <html
      lang={locale}
      className={cn(
        "antialiased",
        "font-sans",
        fontMono.variable,
        inter.variable,
        loraHeading.variable
      )}
    >
      <body>
        <NextIntlClientProvider>
          <Providers initialToken={token}>{props.children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
