"use client"

import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
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

// The content's own exit-fade duration. The CLOSE-direction width collapse
// delays by roughly this long (rule 4's staged-exit pattern: fade first, then
// collapse the now-invisible box) so the sidebar does not visibly retract text
// mid-fade. Opening carries no such delay on the box itself: it widens
// immediately and the content fades in after.
const CONTENT_FADE_OUT = 0.1

// The two directions carry different transitions (the CLOSE side delays by
// the content fade), expressed as per-render animate objects rather than
// named variants: dynamic variants resolved through `custom` proved brittle
// across re-renders, and a conditional object says the same thing plainly.
function panelAnimate(open: boolean, width: number) {
  return open
    ? { width, transition: SPRING }
    : { width: 0, transition: { ...SPRING, delay: CONTENT_FADE_OUT } }
}

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
// Split per docs/ui-animation.md #2 (width/height vs the CSS box model): the
// OUTER motion.div carries ONLY animated geometry (width, marginRight) and no
// visual box styles, so `width: 0` truly means zero and no hairline survives
// the collapse; the INNER nav carries the border, the fixed width (so text
// never rewraps mid-slide) and the flex-col + min-h-0 + overflow-y-auto chain
// that lets the content scroll on its own.
//
// The content mounts only while open (AnimatePresence, a fast fade per rule
// 4's staged-exit guidance) so a collapsed sidebar carries no links in the tab
// order at all, not merely a clipped one.
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
      animate={panelAnimate(open, width)}
      className={cn(
        "shrink-0 overflow-hidden",
        height === "fill" && "min-h-0",
        // self-start gives the flex item a definite height to stick within;
        // without it the item stretches to the row and never sticks.
        height === "sticky" && "sticky top-0 h-svh self-start",
        className
      )}
    >
      {/* initial={false}: a first paint is not a transition. Without it the
          content fades in on every mount, even when a page renders the
          sidebar already open. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="inner-sidebar-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: CONTENT_FADE_OUT } }}
            // pt-2 matches the px-2/pb-2 the rows below already carry, so the
            // column is inset by the same 8px on all four edges. Without it
            // the first control sits against the header's bottom border,
            // since the column starts flush at the header.
            className="flex h-full min-h-0 flex-col border-border border-r pt-2"
            style={{ width }}
          >
            {actions !== undefined && (
              <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
                {actions}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
