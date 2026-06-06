"use client"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"

// Section title per route prefix. Nested role pages keep the Roles title.
const TITLE_KEYS = {
  overview: "nav.overview",
  roles: "nav.roles",
  model: "nav.model",
  results: "nav.results",
} as const

function sectionFor(pathname: string): keyof typeof TITLE_KEYS {
  if (pathname.startsWith("/roles")) return "roles"
  if (pathname.startsWith("/model")) return "model"
  if (pathname.startsWith("/results")) return "results"
  return "overview"
}

export function SiteHeader() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">
          {t(TITLE_KEYS[sectionFor(pathname)])}
        </h1>
      </div>
    </header>
  )
}
