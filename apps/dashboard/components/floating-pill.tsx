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
import { FloatingStackItem } from "@/components/floating-stack"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { SPRING } from "@/lib/motion"

// What the pill is saying, and therefore how it looks. The three tones are the
// retired chapter status block's own language, carried over rather than
// reinvented: the check when the thing it watches is done, the amber when
// something is wrong, the neutral information mark while work is simply
// unfinished.
//
// Unfinished and WRONG are not the same state: being part-way through is the
// ordinary way through a chapter, while a state the model cannot be saved from
// is a warning. They must not read alike at a glance.
export type FloatingPillTone = "info" | "warning" | "ready"

const TONE_ICON = {
  info: InformationCircleIcon,
  warning: Alert02Icon,
  ready: Tick02Icon,
} as const satisfies Record<FloatingPillTone, unknown>

// The pill's own surface per tone. Only the warning tints the box: the app has
// one amber, defined once in lib/alert-tone, and it tints the border AND the
// text together so the whole pill reads as the warning rather than an ordinary
// pill with an orange mark in it.
const TONE_CLASS: Record<FloatingPillTone, string> = {
  info: "",
  warning: WARNING_ALERT_CLASS,
  ready: "",
}

// The mark itself. The warning's mark inherits the tinted text so it cannot
// drift from the border around it; the other two carry their own ink against
// the card's ordinary foreground, which is what keeps the figures beside them
// at full contrast instead of tinting a whole readout for one state word.
const TONE_ICON_CLASS: Record<FloatingPillTone, string> = {
  info: "text-muted-foreground",
  warning: "",
  ready: "text-success",
}

// A chapter's standing readout, floating clear of its content.
//
// It floats because a chapter's content is a grid of dimension columns that has
// to begin at the same height as every other chapter's: any block between the
// framing row and the grid moves that chapter's columns down and makes
// switching tabs a jump. Fixed positioning takes the readout out of flow
// entirely, so it cannot push anything, and it cannot collide with the content
// by construction.
//
// It renders only when it has something to SAY or something to DO. A chapter
// that is finished and saved is the steady state, and a pill standing there to
// confirm it is a control the reader has to look past every time they open the
// page. Nothing to say, nothing on screen.
//
// It does not position itself: it renders into the section's FloatingStack,
// which owns the rail's corner, its gap and its order, and keeps the journey
// instrument at the base with the pills above it. One rail per section means
// a pill and the instrument can never overlap or drift apart.
//
// Shared rather than written per chapter: two chapters carry one of these
// already (the Viktning budget, the Kriterier selection rule), they must read
// as the same object, and a shell copied per chapter would drift the moment
// either is touched.
export function FloatingPill({
  tone,
  children,
}: {
  tone: FloatingPillTone
  // Null is the quiet state: nothing to say, so nothing renders.
  children: ReactNode | null
}) {
  return (
    <FloatingStackItem>
      <AnimatePresence initial={false}>
        {children !== null && (
          <motion.div
            // A real enter and leave (it genuinely arrives when the reader
            // starts work and leaves when the work lands), so it animates
            // rather than blinking. Reduced motion is respected globally
            // through MotionConfig; never bypassed here.
            //
            // `layout` because a pill's states are different widths, and one
            // that jumped from one to the next as the reader works would read
            // as several different pills. Its children carry layout="position"
            // so Motion counter-transforms them: a plain child of a
            // FLIP-scaled box has its text stretched for the length of the
            // spring (ui-animation.md rule 1).
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
            // role="status" rather than the component default of an alert:
            // these readings change under the reader's OWN actions (a weight
            // click changes the budget, choosing a criterion changes what
            // remains), and an assertive live region would interrupt them with
            // their own edit. Polite is right for a readout the reader is
            // driving themselves, and it is what carries the state changes
            // (points left, over budget, ready to save) to a screen reader now
            // that the chapter's status block is gone.
            role="status"
            data-slot="floating-pill"
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
    </FloatingStackItem>
  )
}

// The pill's own text, at the app's reading floor and never smaller: it is the
// only place its chapter states this, so it is read rather than glanced.
// layout="position" for the same reason the mark beside it carries one: it is
// a direct child of a box that FLIP-animates its width.
//
// A pill with no control in it is padded evenly instead of leaving the
// button's gap hanging on its right: pr-2 is room for a control, and a
// sentence alone in it would sit off-centre.
export function FloatingPillText({
  children,
  alone,
}: {
  children: ReactNode
  // Nothing follows this text in the pill.
  alone?: boolean
}) {
  return (
    <motion.span
      layout="position"
      className={cn("text-sm tabular-nums", alone === true && "pr-2")}
    >
      {children}
    </motion.span>
  )
}
