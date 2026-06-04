import type { NextRequest } from "next/server"
import createMiddleware from "next-intl/middleware"
import { routing } from "@workspace/i18n/routing"

const handleI18nRouting = createMiddleware(routing)

export default function proxy(request: NextRequest) {
  return handleI18nRouting(request)
}

export const config = {
  // Hoppa över API-rutter, Next-interna sökvägar och statiska filer
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
}
