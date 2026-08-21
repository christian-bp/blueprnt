"use client"

import {
  Alert02Icon,
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { SPRING } from "@/lib/motion"

// What the pill is saying, and therefore how it looks. The three tones are the
// status block's own language, carried over rather than reinvented when the
// block became a pill: the check when the allocation adds up, the amber when
// it is over the budget, the neutral information mark while it is simply
// unfinished.
//
// Under and over budget are NOT the same state: distributing the last points
// is the ordinary way through this chapter, while an allocation that exceeds
// its budget is a thing the model cannot be saved with. One is a readout, the
// other is a warning, and they must not read alike at a glance.
export type WeightBudgetTone = "info" | "warning" | "ready"

const TONE_ICON = {
  info: InformationCircleIcon,
  warning: Alert02Icon,
  ready: Tick02Icon,
} as const satisfies Record<WeightBudgetTone, unknown>

// The pill's own surface per tone. Only the warning tints the box: the app has
// one amber, defined once in lib/alert-tone, and it tints the border AND the
// text together so the whole pill reads as the warning rather than an ordinary
// pill with an orange mark in it.
const TONE_CLASS: Record<WeightBudgetTone, string> = {
  info: "",
  warning: WARNING_ALERT_CLASS,
  ready: "",
}

// The mark itself. The warning's mark inherits the tinted text so it cannot
// drift from the border around it; the other two carry their own ink against
// the card's ordinary foreground, which is what keeps the figures beside them
// at full contrast instead of tinting a whole readout for one state word.
const TONE_ICON_CLASS: Record<WeightBudgetTone, string> = {
  info: "text-muted-foreground",
  warning: "",
  ready: "text-success",
}

// The Viktning chapter's budget readout and its one save, as a floating pill
// rather than a block at the top of the chapter.
//
// It floats because the chapter's own content is a grid of dimension columns
// that has to begin at the same height as the other chapters' grids: any block
// between the framing row and the grid moves this chapter's columns down and
// makes switching tabs a jump. Fixed positioning takes the readout out of flow
// entirely, so it cannot push anything, and it cannot collide with the content
// by construction.
//
// It renders only when it has something to SAY or something to DO. An
// allocation that adds up and is already saved is the steady state of this
// chapter, and a pill standing there to confirm it is a control the reader has
// to look past every time they open the page. Nothing to say, nothing on
// screen.
//
// Bottom-CENTER rather than a corner: the allocation is the chapter's whole
// subject, so its readout belongs on the reader's centre line, and the toasts
// own the bottom-right on this app. It sits under them in the stack (z-40
// against their z-50) for the one moment both are on screen, which is the
// instant after a save, when this pill is on its way out anyway.
export function WeightBudgetPill({
  tone,
  children,
}: {
  tone: WeightBudgetTone
  // Null is the fourth state: nothing to say, so nothing renders.
  children: ReactNode | null
}) {
  return (
    // The fixed wrapper never animates and never takes pointer events: it is
    // only the centring rail. Keeping the transform off it leaves the pill's
    // own transform free for the enter/leave, which a `-translate-x-1/2`
    // centring would otherwise fight (Motion writes the whole transform).
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <AnimatePresence initial={false}>
        {children !== null && (
          <motion.div
            // A real enter and leave (it genuinely arrives when the reader
            // starts editing and leaves when the edit lands), so it animates
            // rather than blinking. Reduced motion is respected globally
            // through MotionConfig; never bypassed here.
            //
            // `layout` because the three states are different widths, and a
            // pill that jumped from one to the next as the reader clicks
            // weights would read as three different pills. Its children carry
            // layout="position" so Motion counter-transforms them: a plain
            // child of a FLIP-scaled box has its text stretched for the length
            // of the spring (ui-animation.md rule 1).
            //
            // Opacity and y for the enter and leave, on an element carrying no
            // layout of its own to fight: the box styles sit on this same
            // element because it is fixed, so nothing in the page's flow can be
            // clamped by them (rule 2 is about elements that collapse IN flow).
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
            transition={SPRING}
            data-tone={tone}
            className={cn(
              "pointer-events-auto flex max-w-full items-center gap-2 rounded-full border bg-card py-2 pr-2 pl-4 shadow-lg",
              TONE_CLASS[tone]
            )}
          >
            <motion.span layout="position" className="flex shrink-0">
              <HugeiconsIcon
                icon={TONE_ICON[tone]}
                strokeWidth={2}
                aria-hidden="true"
                className={cn("size-4", TONE_ICON_CLASS[tone])}
              />
            </motion.span>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// The pill's own text, at the app's reading floor and never smaller: it is the
// only place this chapter states the budget, so it is read rather than
// glanced. layout="position" for the same reason the mark beside it carries
// one: it is a direct child of a box that FLIP-animates its width.
export function WeightBudgetReadout({ children }: { children: ReactNode }) {
  return (
    <motion.span layout="position" className="text-sm tabular-nums">
      {children}
    </motion.span>
  )
}
