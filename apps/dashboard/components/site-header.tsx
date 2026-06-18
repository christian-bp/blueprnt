"use client"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { SectionTabs } from "@/components/section-tabs"

export function SiteHeader() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()

  const [section] = pathname.split("/").filter(Boolean)

  // The header carries the section identity: the Work section (/work, /roles)
  // gets switchable tabs; the other top-level sections get a plain title.
  const inWorkSection = section === "work" || section === "roles"
  const sectionTitle = section === "model" ? t("nav.model") : t("nav.home")

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex h-full w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          // The vendored separator sizes its vertical variant with
          // data-vertical:self-stretch; with our fixed h-4 (a definite cross
          // size) that resolves to align-self:flex-start and pins the divider
          // to the top of the row. Re-center it with the matching variant so
          // it stays a 16px centered rule.
          className="mx-2 data-[orientation=vertical]:h-4 data-vertical:self-center"
        />
        {inWorkSection ? (
          <SectionTabs />
        ) : (
          <span className="font-medium text-sm">{sectionTitle}</span>
        )}
      </div>
    </header>
  )
}
