"use client"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { type CSSProperties, type ReactNode, useState } from "react"
import { AppHeader } from "@/components/app-header"
import { AppRail } from "@/components/app-rail"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import { InnerSidebar } from "@/components/inner-sidebar"
import { InnerSidebarHandle } from "@/components/inner-sidebar-handle"
import { InnerSidebarNav } from "@/components/inner-sidebar-nav"
import {
  type OrganizationInfo,
  OrganizationProvider,
  useOrganization,
} from "@/components/org-context"
import { ClassificationFooter } from "@/components/people/classification-footer"
import { RunFactsFooter } from "@/components/pay-mapping/run-facts-footer"
import { RunSidebar } from "@/components/pay-mapping/run-sidebar"
import { TodoFooter } from "@/components/todo-footer"
import { RoleSheetProvider } from "@/components/role-sheet"
import { areaForPathname, innerNavFor } from "@/lib/navigation"
import {
  areaSidebarCookie,
  initialInnerSidebarOpen,
  persistInnerSidebarOpen,
} from "@/lib/inner-sidebar-state"

// The signed-in, onboarded application frame, on the inset pattern: the icon
// rail stands on the gray ground (bg-sidebar via the vendor wrapper), and
// everything else (top bar, inner sidebar, content) lives on the white
// rounded sheet beside it. The wrapper is locked to the viewport, and the
// CONTENT PANE is the app's one scroller, which is what lets the inner
// sidebar and the header hold their ground at every scroll position.

// The inset a page's content keeps from the sheet's edges. Exported for the
// self-managed routes (assistant, docs) that take the padding off the shell
// and apply it to their own content column instead: one constant so the two
// can never drift into two different page insets.
export const PAGE_PADDING = "p-4"

// A centered column exactly as wide as a normal page's visible content
// (max-w-7xl minus the p-4 on each side), for use inside the full-bleed /work
// route: anything there that should line up with other pages' content uses
// this instead of re-deriving the math.
export const PAGE_CONTENT_MAX_W = "mx-auto w-full max-w-[calc(80rem-2rem)]"

// The per-route class string for the page content column inside the scroll
// pane. Pure so a regression here (the wrong route matched, a class dropped)
// is a plain unit test, not a render of the whole authenticated shell.
export function pageContentClasses(pathname: string): string {
  // Routes that own their whole pane: they compose their own columns (the
  // assistant's panel + chat, the docs nav + article, /work's viewport-locked
  // matrix) and center their own reading column in what remains.
  const selfManaged =
    pathname === "/assistant" ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/") ||
    pathname === "/work"
  if (selfManaged) return "flex h-full min-h-0 w-full flex-col"
  // ONE cap for every routed page. The model and the pay-mapping runs briefly
  // carried a wider tier of their own, which made moving between areas read
  // as the page changing size; whatever a surface gains from extra width it
  // loses in the app no longer holding one line. Surfaces that genuinely
  // need more than the cap (the family matrix) break out of it explicitly
  // and put the chrome back, rather than widening their whole area.
  return cn("mx-auto flex w-full flex-col gap-5", PAGE_PADDING, "max-w-7xl")
}

// Whether a pathname sits inside one pay-mapping run (the page-owned run
// sidebar) rather than an area with registry rows.
function inPayMappingRun(pathname: string): boolean {
  return /^\/pay-mappings\/[^/]+(\/|$)/.test(pathname)
}

// The area chrome: the inner sidebar (registry rows or the run sidebar) plus
// the content pane with the collapse handle at their seam. One component owns
// the open state so the sidebar and the handle can never disagree; it is
// keyed by the area id in AppShell, so each area wakes up on its own
// remembered choice.
function AreaChrome({
  areaId,
  sidebar,
  footer,
  children,
}: {
  areaId: string
  sidebar: ReactNode | null
  // The sidebar's bottom block (InnerSidebar's footer slot); only rendered
  // while the area has a sidebar at all.
  footer?: ReactNode
  children: ReactNode
}) {
  const t = useTranslations("dashboard.shell")
  const [open, setOpen] = useState(() =>
    initialInnerSidebarOpen(areaSidebarCookie(areaId))
  )
  function toggle() {
    const next = !open
    setOpen(next)
    persistInnerSidebarOpen(areaSidebarCookie(areaId), next)
  }
  return (
    <div className="flex min-h-0 flex-1">
      {sidebar !== null && (
        <InnerSidebar
          open={open}
          label={t("areaNav")}
          height="fill"
          footer={footer}
          // Below md the rail collapses into the nav sheet, which already
          // lists these rows; keeping the 240px column too would squeeze the
          // content to a sliver (the docs nav takes the same way out).
          className="hidden md:flex"
        >
          {sidebar}
        </InnerSidebar>
      )}
      {/* Relative and NON-scrolling: its left edge is the nav/content seam at
          every animation frame, which is what the handle stands on; the
          scrolling happens one level down in <main>.

          min-w-0 IS LOAD-BEARING. This is a flex item in a row, so without it
          its automatic minimum size is its MIN-CONTENT width: one wide table
          anywhere below then pushes the whole pane wider than the space it
          was given, and because the pane is what <main> and every page column
          measure against, a centered column (mx-auto) inside it slides
          sideways by half the excess. That is exactly what the /work families
          grid did: mounting its 12-level table grew the pane by 96px and
          moved the page's breadcrumbs 48px right, on a tab switch, for good.
          With the floor at 0 the pane keeps the width it was given and wide
          content scrolls inside its own container, which is where the
          wide-content rule always meant it to scroll. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {sidebar !== null && (
          <InnerSidebarHandle
            open={open}
            onToggle={toggle}
            collapseLabel={t("collapseNav")}
            expandLabel={t("expandNav")}
          />
        )}
        {children}
      </div>
    </div>
  )
}

function ShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { role } = useOrganization()
  const area = areaForPathname(pathname)
  const run = inPayMappingRun(pathname)
  const groups = area === undefined ? [] : innerNavFor(area, role)
  // The assistant belongs to the Home area but owns its whole pane: its
  // conversations panel is the sidebar there, and the area nav beside it
  // would stack a second 240px column against the chat.
  const sidebar =
    pathname === "/assistant" ? null : run ? (
      <RunSidebar />
    ) : groups.length > 0 ? (
      <InnerSidebarNav groups={groups} />
    ) : null
  // The sidebar's bottom blocks: an area's own block where one carries real
  // information (the run's frozen key figures, the people area's
  // classification split), then the to-do glance on every area, pinned
  // bottom-most so it holds one position app-wide.
  const footer =
    sidebar === null ? undefined : (
      <>
        {run ? (
          <RunFactsFooter />
        ) : area?.id === "people" ? (
          <ClassificationFooter />
        ) : null}
        <TodoFooter />
      </>
    )
  // The run sidebar remembers its own collapse choice apart from the list's.
  const areaId = run ? "payMappingRun" : (area?.id ?? "none")
  return (
    <AreaChrome key={areaId} areaId={areaId} sidebar={sidebar} footer={footer}>
      <main data-slot="app-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <div className={pageContentClasses(pathname)}>
          {/* Role quick-look sheet, openable from any role chip in the app
              (e.g. the Overview); renders nothing and runs no queries until
              a role is opened. */}
          <RoleSheetProvider>{children}</RoleSheetProvider>
        </div>
      </main>
    </AreaChrome>
  )
}

export function AppShell(props: {
  organization: OrganizationInfo
  children: ReactNode
}) {
  return (
    <OrganizationProvider value={props.organization}>
      {/* This ui package's sidebar variant does not bundle a TooltipProvider;
          the rail's tooltips and the collapse handle's require one at the app
          level. */}
      <TooltipProvider>
        <SidebarProvider
          // h-screen locks the frame to the viewport: the sheet is exactly
          // viewport minus its m-2 margins, and the content pane inside it is
          // the app's one scroller.
          className="h-screen [--sidebar-accent-foreground:var(--color-primary)] [--sidebar-accent:color-mix(in_oklab,var(--color-primary)_6%,transparent)]"
          style={
            {
              // The Verve reference rail width: the size-8 rail buttons plus
              // the container's and the icon column's own p-2 need the full
              // 63px; at 3.5rem the button column overflowed its gutter.
              "--sidebar-width": "63px",
              "--header-height": "50px",
              "--sidebar-width-inner": "240px",
            } as CSSProperties
          }
        >
          {/* The command palette is mounted here, beside the rail rather than
              inside it: below the 768px breakpoint the rail renders in a
              sheet that unmounts its children while closed, which would take
              the palette's global shortcut with it. */}
          <CommandPaletteProvider>
            <AppRail />
            <SidebarInset className="overflow-hidden border border-border shadow-none">
              <AppHeader />
              <ShellContent>{props.children}</ShellContent>
            </SidebarInset>
          </CommandPaletteProvider>
        </SidebarProvider>
      </TooltipProvider>
    </OrganizationProvider>
  )
}
