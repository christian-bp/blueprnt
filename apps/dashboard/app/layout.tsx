import "@workspace/ui/globals.css"

import type { Locale } from "@workspace/i18n/routing"
import { cn } from "@workspace/ui/lib/utils"
import { getLocale, getMessages } from "next-intl/server"
import { Geist_Mono, Inter, Lora } from "next/font/google"
import type { ReactNode } from "react"
import { LocaleProvider } from "@/components/locale-provider"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"

// Same fonts and variable names as apps/web: the shared globals.css maps
// font-sans/font-heading/font-mono to these runtime variables.
const loraHeading = Lora({ subsets: ["latin"], variable: "--font-heading" })
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default async function RootLayout(props: { children: ReactNode }) {
  // Server-resolved from the locale cookie (i18n/request.ts); used for the
  // initial paint and <html lang>. The client LocaleProvider then follows the
  // reactive getUiLocale query and swaps the language live.
  const locale = (await getLocale()) as Locale
  const messages = await getMessages()
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
        <Providers initialToken={token}>
          <LocaleProvider initialLocale={locale} initialMessages={messages}>
            {props.children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  )
}
