"use client"

import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { CreateMenu } from "@/components/create-menu"
import { OrgSwitcher } from "@/components/org-switcher"
import { SearchButton } from "@/components/search-button"

// The white sheet's top bar: company switcher on the left, the search trigger
// dead center (absolute, so the sides' widths cannot push it around), the
// Create menu on the right. On mobile the sheet trigger leads and the search
// collapses away (the palette stays reachable through the keyboard shortcut
// and the mobile nav).
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) w-full shrink-0 items-center gap-1.5 border-b bg-background ps-2.5 pe-2">
      <SidebarTrigger className="md:hidden" />
      <OrgSwitcher />
      <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
        <SearchButton />
      </div>
      <div className="ms-auto flex items-center gap-1">
        <CreateMenu />
      </div>
    </header>
  )
}
