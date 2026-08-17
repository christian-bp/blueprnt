"use client"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { usePathname } from "next/navigation"
import { type CSSProperties, type ReactNode, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
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

// The inset a page's content keeps from the edges of the content pane.
// Exported because the inner-sidebar routes take it off the shell (their nav
// column must sit flush) and apply it to their own content column instead: one
// constant so the two can never drift into two different page insets.
export const PAGE_PADDING = "px-4 py-4 md:py-6 lg:px-6"

// The per-route class strings for the four shell layers between SidebarInset
// and the page's own content, keyed off the pathname alone. Pure so a
// regression here (the wrong route matched, a class dropped) is a plain unit
// test, not a render of the whole authenticated shell (sidebar nav, org
// context, auth-backed user menu) just to read a class off a div.
export function shellLayoutClasses(pathname: string) {
  // The level-architecture views (/work: ladder, matrix, families) are wide
  // grid surfaces that earn the whole viewport, width AND height: the content
  // pane locks to the viewport height and the view scrolls inside it. Every
  // other page keeps the capped reading width and normal page flow.
  const fullBleed = pathname === "/work"
  // /assistant needs the same viewport-locked SidebarInset as /work's
  // fullBleed: a long message thread must never grow the page past the
  // viewport, or the conversation's own scroll container (its one intended
  // scroller) never gets a bounded height to scroll within, pushing the
  // composer out of reach with no scroller that leads to it. Unlike
  // fullBleed it keeps the normal reading width (PAGE_MAX_W below), and its
  // lock is not md:-gated: the assistant's height must stay constant
  // regardless of thread length on mobile too.
  const assistantBounded = pathname === "/assistant"
  const heightLocked = fullBleed || assistantBounded
  // The routes that carry an INNER SIDEBAR: a secondary nav column between
  // the app sidebar and the page content (the assistant's conversations
  // panel, the docs nav). They drop the centred cap AND the shell's own
  // padding, because that column is a continuation of the app sidebar rather
  // than an object on the page: its right border is the seam between nav and
  // content, so it has to reach the app sidebar's border and run the pane's
  // full height, which neither a narrower cap nor a gutter above or beside it
  // allows. Each page then owns the padding for its own content column and
  // centers its reading column in what remains.
  // Matched as an exact segment, never a bare startsWith, so a future sibling
  // route beginning with the same characters is not swallowed.
  //
  // Independent of the height lock: /assistant locks (a long thread must not
  // grow the page past the viewport), /docs does not (its nav pins itself and
  // the page keeps scrolling, which is what DocsHashScroll's window.scrollY
  // read depends on).
  const hasInnerSidebar =
    assistantBounded || pathname === "/docs" || pathname.startsWith("/docs/")
  // Screen-centering is per-page opt-in, not the default: today only the
  // overview centers its capped column (the assistant centers its own
  // reading column inside an uncapped row, so it needs nothing here);
  // every other page keeps the left-aligned column. A page that should
  // center later opts in here.
  const centered = pathname === "/"
  // The whole run workspace (overview, analysis, actions, report) is a data
  // surface: wide tables and plots, not prose. The overview's KPI strip wants
  // four tiles across at the same cap its analysis tables use, and a run that
  // changed width from tab to tab read as two different pages.
  const wide = /^\/pay-mappings\/[^/]+(\/|$)/.test(pathname)
  return {
    sidebarInset: cn(
      // The content pane sits flush against the sidebar with no margin of its
      // own, so the viewport height IS its height: no chrome to subtract.
      fullBleed && "md:h-svh md:overflow-hidden",
      // /work's lock starts at md (below it the matrix stacks and scrolls with
      // the page); the assistant's holds at every breakpoint.
      assistantBounded && "h-svh overflow-hidden"
    ),
    flexShell: cn("flex flex-1 flex-col", heightLocked && "min-h-0"),
    containerMain: cn(
      "@container/main flex flex-1 flex-col gap-2",
      heightLocked && "min-h-0"
    ),
    pageContent: cn(
      "flex w-full flex-col",
      // The shell's padding and band gap, which the inner-sidebar routes hand
      // to their own content column instead (see hasInnerSidebar above).
      !hasInnerSidebar && cn("gap-4 md:gap-6", PAGE_PADDING),
      centered && "mx-auto",
      heightLocked && "min-h-0 flex-1",
      // /assistant and /docs are uncapped like /work: their inner sidebar
      // (the conversations panel, the docs nav) must sit against the app
      // sidebar's border, which no centered cap allows; each page centers
      // its own reading column in the space beside the panel.
      !(heightLocked || hasInnerSidebar) &&
        (wide ? PAGE_WIDE_MAX_W : PAGE_MAX_W)
    ),
  }
}

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
  const layout = shellLayoutClasses(pathname)
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
          {/* The command palette is mounted here, beside the sidebar rather
              than inside it: below the 768px breakpoint the sidebar renders
              in a sheet that unmounts its children while closed, which would
              take the palette's global shortcut with it. It adds no element
              of its own to this row (a context provider plus a dialog that
              portals when open), so the shell's layout is untouched. */}
          <CommandPaletteProvider>
            {/* The default `sidebar` variant, deliberately not `inset`: the
                content pane is a flush region of one surface, separated from
                the nav by the sidebar's own right border, instead of a rounded
                card floating in a sidebar-coloured gutter. */}
            <AppSidebar />
            <SidebarInset className={layout.sidebarInset}>
              <SiteHeader />
              <div className={layout.flexShell}>
                <div className={layout.containerMain}>
                  <div className={layout.pageContent}>
                    {/* Role quick-look sheet, openable from any role chip in
                        the app (e.g. the Overview); renders nothing and runs
                        no queries until a role is opened. */}
                    <RoleSheetProvider>{props.children}</RoleSheetProvider>
                  </div>
                </div>
              </div>
            </SidebarInset>
          </CommandPaletteProvider>
        </SidebarProvider>
      </TooltipProvider>
    </OrganizationProvider>
  )
}
