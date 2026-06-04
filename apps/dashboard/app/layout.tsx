import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"

export default async function RootLayout(props: { children: ReactNode }) {
  const locale = await getLocale()
  const token = await getToken()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers initialToken={token ?? null}>{props.children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
