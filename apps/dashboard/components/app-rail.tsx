"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandMark } from "@/components/brand-mark"
import { InnerSidebarNav } from "@/components/inner-sidebar-nav"
import { NavUser } from "@/components/nav-user"
import { useOrganization } from "@/components/org-context"
import {
  areaForPathname,
  areasFor,
  innerNavFor,
  NAV_ADMIN_AREA,
  type NavArea,
  settingsHrefFor,
} from "@/lib/navigation"

// The fixed icon rail on the app frame's gray ground: the brand mark on top,
// one icon per area, guide + settings + the account avatar at the bottom. It
// never expands on desktop; below md the vendor Sidebar renders these children
// in a sheet, where the md:hidden label column beside the icons carries the
// full nav (Verve's two-column mobile pattern).
export function AppRail() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const { role } = useOrganization()
  const { setOpenMobile } = useSidebar()
  // Platform staff see the admin console area. The same query the account
  // menu's admin row and the /admin layout gate already ask, so this
  // subscription is deduped, and the layout stays the real gate.
  const isPlatformAdmin = useQuery(api.platform.admin.isPlatformAdmin)
  const areas = areasFor(role)
  const active = areaForPathname(pathname)

  const railButton = (area: NavArea) => {
    const isActive = active?.id === area.id
    const href = area.id === "settings" ? settingsHrefFor(role) : area.href
    return (
      <Tooltip key={area.id}>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(area.labelKey)}
              aria-current={isActive ? "page" : undefined}
              nativeButton={false}
              className={cn(
                "size-8",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
              )}
              onClick={() => setOpenMobile(false)}
              render={<Link href={href} />}
            />
          }
        >
          <HugeiconsIcon icon={area.icon} strokeWidth={2} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="right">{t(area.labelKey)}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <div className="flex h-full grow">
        {/* Icon column: the rail itself, on desktop and inside the sheet. */}
        <div className="flex h-full shrink-0 flex-col items-center">
          <SidebarHeader className="items-center py-3">
            <Link href="/" aria-label={t("nav.home")}>
              <BrandMark />
            </Link>
          </SidebarHeader>
          <SidebarContent className="items-center overflow-visible">
            <div className="flex flex-col gap-0.5 p-2">
              {areas
                .filter((area) => area.placement === "main")
                .map(railButton)}
              {isPlatformAdmin === true && railButton(NAV_ADMIN_AREA)}
            </div>
          </SidebarContent>
          <SidebarFooter className="items-center gap-0.5 p-2">
            {areas
              .filter((area) => area.placement === "footer")
              .map(railButton)}
            <NavUser />
          </SidebarFooter>
        </div>
        {/* Label column: mobile sheet only. The areas by name, with the active
            area's own rows beneath it, every link closing the sheet. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto border-border/60 border-l py-1 md:hidden">
          <div className="flex flex-col gap-0.5 px-1 pt-2">
            {[
              ...areas,
              ...(isPlatformAdmin === true ? [NAV_ADMIN_AREA] : []),
            ].map((area) => {
              const isActive = active?.id === area.id
              const href =
                area.id === "settings" ? settingsHrefFor(role) : area.href
              const groups = innerNavFor(area, role)
              return (
                <div key={area.id}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-2.5",
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "font-normal text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                    nativeButton={false}
                    onClick={() => setOpenMobile(false)}
                    render={<Link href={href} />}
                  >
                    <HugeiconsIcon
                      icon={area.icon}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">{t(area.labelKey)}</span>
                  </Button>
                  {isActive && groups.length > 0 && (
                    <div className="ms-4">
                      <InnerSidebarNav
                        groups={groups}
                        onNavigate={() => setOpenMobile(false)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
