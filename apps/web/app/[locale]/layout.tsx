import { Geist_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { routing } from "@workspace/i18n/routing"

import "../globals.css"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@workspace/ui/lib/utils"

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-next",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Enables static rendering of [locale] routes
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      className={cn(
        "antialiased",
        fontSans.variable,
        fontDisplay.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <NextIntlClientProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
