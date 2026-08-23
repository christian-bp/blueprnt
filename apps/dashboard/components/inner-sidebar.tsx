"use client"

import { cn } from "@workspace/ui/lib/utils"
import { motion } from "motion/react"
import type { ReactNode } from "react"
import { SPRING } from "@/lib/motion"

// The one open width: every surface (area navs, the run sidebar, the
// assistant's conversation list) shares it, per the uniform-sidebar
// direction; the prop exists for a future surface with a real reason to
// differ. The width is carried by the sidebar's OWN animated geometry
// rather than a flex `gap` on the row: a container gap does not collapse
// with a shrinking flex item (docs/ui-animation.md #3), so collapsed truly
// means zero footprint.
const DEFAULT_WIDTH = 240

// The app's inner sidebar: the secondary navigation column that sits between
// the app rail and a page's content (an area's nav rows, the docs nav, the
// assistant's conversations panel). A flush column with a single border on its
// right, no radius and no fill of its own, so the nav and the content beside
// it read as two regions of ONE surface.
//
// `open` is owned by the CALLER, never by this component: the surface renders
// the InnerSidebarHandle (or another control) beside it, and shared ownership
// is what stops the two from ever disagreeing. Collapse/expand controls are
// NOT part of this component: the shell's handle sits at the seam between nav
// and content (inner-sidebar-handle.tsx), which no element inside a
// width-animated, overflow-hidden box could survive collapsing.
//
// The collapse is a pure width slide (the Verve pattern): the content column
// keeps its full width and full opacity while the box narrows, so the seam
// line sweeps left ACROSS the content and covers it, instead of the content
// fading out first. The seam line is therefore an absolutely anchored child
// riding the OUTER box's right edge (right-0 inside the clipping box), never
// a border on the fixed-width content column, where it would sit at the far
// edge and be clipped away the moment the slide starts.
//
// Split per docs/ui-animation.md #2 (width/height vs the CSS box model): the
// OUTER motion.aside carries ONLY animated geometry (width) and no visual box
// styles, so `width: 0` truly means zero; the content column carries the
// padding, the fixed width (so text never rewraps mid-slide) and the flex-col
// + min-h-0 + overflow-y-auto chain that lets the content scroll on its own.
// The outer IS the positioning context here, deliberately: the seam line must
// track the animated edge, and at width 0 the overflow clip removes it, so no
// hairline survives the collapse (the invariant rule #2 exists for).
//
// The content stays mounted while collapsed (unmounting is what forced the
// old fade) and is made `inert` instead, so a collapsed sidebar still carries
// no links in the tab order and nothing in the accessibility tree.
//
// Two height modes, because the two kinds of surface scroll differently:
//   fill   - the parent is height-locked and this fills it (the shell's
//            content row, the assistant).
//   sticky - the page scrolls and this pins to the viewport, so its border
//            spans top to bottom at every scroll position.
export function InnerSidebar({
  open,
  label,
  width = DEFAULT_WIDTH,
  height = "fill",
  actions,
  footer,
  className,
  children,
}: {
  open: boolean
  // Names the landmark for assistive technology.
  label: string
  width?: number
  height?: "fill" | "sticky"
  // The surface's own header content (e.g. the assistant's new-conversation
  // button). A sidebar without actions renders no header row at all, so its
  // content starts at the top of the column instead of below an empty strip.
  actions?: ReactNode
  // A bottom block pinned under the scrolling content (the Verve
  // live-metrics anatomy): Home's to-do glance, the people area's
  // classification split, a run's key figures. Inside the inert column, so
  // a collapsed sidebar's footer keeps no tab stops either.
  footer?: ReactNode
  // Responsive visibility only (e.g. `hidden lg:flex`). Never box styles: the
  // outer element is the animated one, and a border or padding here would
  // survive the collapse (see the class invariant in the tests).
  className?: string
  children: ReactNode
}) {
  return (
    // An aside, as in the Verve reference: the column is a complementary
    // landmark beside the page, and the nav element (when the content is
    // registry rows) lives inside it (InnerSidebarNav).
    <motion.aside
      initial={false}
      aria-label={label}
      data-state={open ? "open" : "closed"}
      animate={{ width: open ? width : 0 }}
      transition={SPRING}
      className={cn(
        "relative shrink-0 overflow-hidden",
        height === "fill" && "min-h-0",
        // self-start gives the flex item a definite height to stick within;
        // without it the item stretches to the row and never sticks.
        height === "sticky" && "sticky top-0 h-svh self-start",
        className
      )}
    >
      {/* pt-2 matches the px-2/pb-2 the rows below already carry, so the
          column is inset by the same 8px on all four edges. Without it the
          first control sits against the header's bottom border, since the
          column starts flush at the header. */}
      <div
        inert={!open}
        className="flex h-full min-h-0 flex-col pt-2"
        style={{ width }}
      >
        {actions !== undefined && (
          <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
            {actions}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">{children}</div>
        {/* No box styles on the slot itself: each block inside brings its own
            top border (SidebarFooterBlock), so a footer whose every block has
            nothing to say renders nothing visible. */}
        {footer !== undefined && <div className="shrink-0">{footer}</div>}
      </div>
      {/* The seam line, riding the clipping box's own right edge so the
          collapse sweeps it across the content; clipped away entirely at
          width 0. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-px bg-border"
      />
    </motion.aside>
  )
}
