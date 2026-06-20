import "@workspace/ui/globals.css"

import type { Locale } from "@workspace/i18n/routing"
import { cn } from "@workspace/ui/lib/utils"
import type { Metadata } from "next"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { Geist_Mono, Source_Sans_3 } from "next/font/google"
import type { ReactNode } from "react"
import { LocaleProvider } from "@/components/locale-provider"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"
import { TITLE_SEPARATOR } from "@/lib/page-title"

// Server-side default and template for the document <title>. Pages set their
// own title on the client (usePageTitle) so it tracks the live locale switch;
// this guarantees a real brand title on the first paint and a "%s · blueprnt"
// shape for any future server-rendered route. The brand stays sourced from
// i18n (dashboard.title).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard")
  const brand = t("title")
  return {
    title: { default: brand, template: `%s${TITLE_SEPARATOR}${brand}` },
  }
}

// Same fonts and variable names as apps/web. The radix-vega preset maps
// font-heading to font-sans in the shared globals.css, so no separate
// heading font is loaded.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
})
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
        sourceSans.variable
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
