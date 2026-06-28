"use client"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import type { CSSProperties, ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  type OrganizationInfo,
  OrganizationProvider,
} from "@/components/org-context"
import { RoleSheetProvider } from "@/components/role-sheet"
import { SiteHeader } from "@/components/site-header"

// The signed-in, onboarded application frame: sidebar + header + page
// content. Mounted by OnboardingGate once onboarding is complete.
export function AppShell(props: {
  organization: OrganizationInfo
  children: ReactNode
}) {
  return (
    <OrganizationProvider value={props.organization}>
      {/* This ui package's sidebar variant does not bundle a TooltipProvider;
          SidebarMenuButton tooltips require one at the app level. */}
      <TooltipProvider>
        <SidebarProvider
          // Collapsed icon rail is the default; expanding is the opt-in
          // (toggle, rail, or cmd+b).
          defaultOpen={false}
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
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
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
