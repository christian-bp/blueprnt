"use client"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { usePathname } from "next/navigation"
import { type CSSProperties, type ReactNode, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { initialSidebarOpen } from "@/lib/sidebar-state"
import {
  type OrganizationInfo,
  OrganizationProvider,
} from "@/components/org-context"
import { RoleSheetProvider } from "@/components/role-sheet"
import { SiteHeader } from "@/components/site-header"

// The signed-in, onboarded application frame: sidebar + header + page
// content. Mounted by OnboardingGate once onboarding is complete.
// The cap a normal page gets. It sits on the element that ALSO carries the
// page padding, so a page's visible content is this minus px-4 (lg:px-6).
export const PAGE_MAX_W = "max-w-6xl"

// The wider cap for pages whose content is a data surface rather than
// reading text. The pay-mapping analysis is the case: a 320px step column
// beside a comparator table that needs 56rem to show a job title next to
// its figures, plus scatter plots that read better the more room the
// points have to separate. At 6xl those tables scroll horizontally inside
// a column narrower than they are, which is the worst of both.
//
// Deliberately NOT applied everywhere: a page of prose at 80rem is a wall,
// and the 6xl cap is what keeps ordinary pages readable.
export const PAGE_WIDE_MAX_W = "max-w-[85rem]"

// The same width measured as CONTENT, for use inside /work: that route is
// full-bleed (no cap, so its matrix can use every pixel), which means anything
// there that should line up with other pages has to subtract the padding the
// shell would otherwise have included. Capping at a bare PAGE_MAX_W instead
// makes it wider than every other page by exactly that padding. 72rem is 6xl.
export const PAGE_CONTENT_MAX_W =
  "max-w-[calc(72rem-2rem)] lg:max-w-[calc(72rem-3rem)]"

export function AppShell(props: {
  organization: OrganizationInfo
  children: ReactNode
}) {
  const pathname = usePathname()
  // Expanded sidebar for first-time visitors (the nav labels are part of the
  // app's guidance; the icon rail is a returning user's opt-in). The vendor
  // sidebar persists every toggle to a cookie but never reads it back, so the
  // mount-time read here is what makes the choice survive a reload.
  const [defaultOpen] = useState(initialSidebarOpen)
  // The level-architecture views (/work: ladder, matrix, families) are wide
  // grid surfaces that earn the whole viewport, width AND height: the inset
  // card locks to the viewport (its rounded bottom never pushed off-screen)
  // and the view scrolls inside. Every other page keeps the capped reading
  // width and normal page flow.
  const fullBleed = pathname === "/work"
  // The whole run workspace (overview, analysis, actions, report) is a data
  // surface: wide tables and plots, not prose. The overview's KPI strip wants
  // four tiles across at the same cap its analysis tables use, and a run that
  // changed width from tab to tab read as two different pages.
  const wide = /^\/pay-mappings\/[^/]+(\/|$)/.test(pathname)
  return (
    <OrganizationProvider value={props.organization}>
      {/* This ui package's sidebar variant does not bundle a TooltipProvider;
          SidebarMenuButton tooltips require one at the app level. */}
      <TooltipProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          style={
            {
              // Narrower than the shadcn default: the nav is three short
              // top-level items, so 15rem is plenty and the footer still fits.
              "--sidebar-width": "calc(var(--spacing) * 60)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset
            className={cn(
              // 1rem = the inset variant's own m-2 top+bottom margins.
              fullBleed && "md:h-[calc(100svh_-_1rem)] md:overflow-hidden"
            )}
          >
            <SiteHeader />
            <div className={cn("flex flex-1 flex-col", fullBleed && "min-h-0")}>
              <div
                className={cn(
                  "@container/main flex flex-1 flex-col gap-2",
                  fullBleed && "min-h-0"
                )}
              >
                <div
                  className={cn(
                    "flex w-full flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6",
                    fullBleed
                      ? "min-h-0 flex-1"
                      : wide
                        ? PAGE_WIDE_MAX_W
                        : PAGE_MAX_W
                  )}
                >
                  {/* Role quick-look sheet, openable from any role chip in the
                      app (e.g. the Overview); renders nothing and runs no
                      queries until a role is opened. */}
                  <RoleSheetProvider>{props.children}</RoleSheetProvider>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </OrganizationProvider>
  )
}
