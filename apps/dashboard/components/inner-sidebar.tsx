"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, type Variants } from "motion/react"
import type { ReactNode } from "react"
import { SPRING } from "@/lib/motion"

// The open width and the gap the sidebar carries to the content column, both
// carried by the sidebar's OWN animated geometry rather than a flex `gap` on
// the row: a container gap does not collapse with a shrinking flex item
// (docs/ui-animation.md #3), so a `gap-*` on the row would still reserve dead
// space once the width reached 0. Animating both together means collapsed
// truly means zero footprint, no gap artifact left behind.
export const INNER_SIDEBAR_WIDTH = 280
const INNER_SIDEBAR_GAP = 16

// The content's own exit-fade duration. The CLOSE-direction width collapse
// delays by roughly this long (rule 4's staged-exit pattern: fade first, then
// collapse the now-invisible box) so the sidebar does not visibly retract text
// mid-fade. Opening carries no such delay on the box itself: it widens
// immediately and the content fades in after.
const CONTENT_FADE_OUT = 0.1

// A collapse control's two halves travel together: a surface either takes both
// the handler and the label for the control's accessible name, or neither and
// renders no control. As two independent optional props, a handler without a
// label would compile and ship a button no screen reader can name.
type InnerSidebarCollapse =
  | { onCollapse: () => void; collapseLabel: string }
  | { onCollapse?: never; collapseLabel?: never }

// Variants (not a single inline `animate` object) so the CLOSE direction can
// carry its own delayed transition without affecting the OPEN direction.
const panelVariants: Variants = {
  open: {
    width: INNER_SIDEBAR_WIDTH,
    marginRight: INNER_SIDEBAR_GAP,
    transition: SPRING,
  },
  closed: {
    width: 0,
    marginRight: 0,
    transition: { ...SPRING, delay: CONTENT_FADE_OUT },
  },
}

// The app's inner sidebar: the secondary navigation column that sits between
// the app sidebar and a page's content (the docs nav, the assistant's
// conversations panel). A flush column with a single border on its right, no
// radius and no fill of its own, so the nav and the content beside it read as
// two regions of ONE surface rather than an object floating inside the inset
// card the page already is.
//
// `open` is owned by the CALLER, never by this component: the page renders
// both this sidebar's own collapse button and the expand button that stands in
// for it while collapsed, and shared ownership is what stops the two from ever
// disagreeing.
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
// Two height modes, because the two surfaces scroll differently:
//   fill   - the parent is height-locked and this fills it (the assistant).
//   sticky - the page scrolls and this pins to the viewport, so its border
//            spans top to bottom at every scroll position (the docs).
//
// Collapsing is opt-in: the assistant's panel collapses, the docs nav does not,
// because a guide nav is the only navigation its surface has. A sidebar with
// neither a collapse control nor actions renders no header row at all, so its
// content starts at the top of the column instead of below an empty strip.
export function InnerSidebar({
  open,
  label,
  height = "fill",
  actions,
  className,
  onCollapse,
  collapseLabel,
  children,
}: {
  open: boolean
  // Names the landmark for assistive technology.
  label: string
  height?: "fill" | "sticky"
  // The surface's own header content, left of the collapse control.
  actions?: ReactNode
  // Responsive visibility only (e.g. `hidden lg:flex`). Never box styles: the
  // outer element is the animated one, and a border or padding here would
  // survive the collapse (see the class invariant in the tests).
  className?: string
  children: ReactNode
} & InnerSidebarCollapse) {
  return (
    <motion.div
      initial={false}
      variants={panelVariants}
      animate={open ? "open" : "closed"}
      className={cn(
        "shrink-0 overflow-hidden",
        height === "fill" && "min-h-0",
        // self-start gives the flex item a definite height to stick within;
        // without it the item stretches to the row and never sticks.
        height === "sticky" && "sticky top-0 h-svh self-start",
        className
      )}
    >
      <AnimatePresence>
        {open && (
          <motion.nav
            key="inner-sidebar-content"
            aria-label={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: CONTENT_FADE_OUT } }}
            className="flex h-full min-h-0 flex-col border-border border-r"
            style={{ width: INNER_SIDEBAR_WIDTH }}
          >
            {(actions !== undefined || onCollapse !== undefined) && (
              <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
                {/* An empty span keeps a lone collapse control right-aligned
                    without the row's justify-between changing per surface. */}
                {actions ?? <span />}
                {onCollapse !== undefined && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={collapseLabel}
                    onClick={onCollapse}
                  >
                    {/* The app's standard chevron, pointing the way the
                        sidebar folds. */}
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {children}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// The collapsed sidebar's stand-in slot, pinned to the top-left of the content
// column (which must therefore be `relative`). Lives here rather than in each
// page so both surfaces place their stand-in identically.
export function InnerSidebarPinnedActions({
  className,
  children,
}: {
  // Responsive visibility only, matched to the sidebar's own: a stand-in for
  // a sidebar that is not rendered at this breakpoint is a dead control.
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "absolute top-2 left-2 z-10 flex flex-col gap-1",
        className
      )}
    >
      {children}
    </div>
  )
}

// The control that brings a collapsed sidebar back. The default glyph is the
// chevron mirroring the collapse control; a surface passes its own icon when
// the icon can NAME what comes back better than a direction can (the assistant
// passes HistoryIcon for its conversations).
export function InnerSidebarExpandButton({
  label,
  icon = ArrowRight01Icon,
  onExpand,
}: {
  label: string
  icon?: IconSvgElement
  onExpand: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onExpand}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
    </Button>
  )
}
