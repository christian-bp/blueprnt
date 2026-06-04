import "@workspace/ui/globals.css"

import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"

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
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers initialToken={token}>{props.children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
