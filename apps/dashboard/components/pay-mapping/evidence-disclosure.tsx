"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Accordion } from "@workspace/ui/components/accordion"
import type { ReactNode } from "react"
import { AccordionSection } from "@/components/accordion-section"
import { FrameCardSection } from "@/components/frame-card"

// Rung 3 of the ladder: the evidence behind one step, collapsed inside that
// step. It is never moved OUT of the step: the task on that screen is
// writing a sakligt skäl that survives a DO review, and the member table
// also carries the per-row documentation menu, so an excerpt elsewhere
// would mean documenting against a partial population.
//
// Collapsing it is what makes every opened step start at roughly the same
// height with its form at the bottom, so "mark done and continue" becomes a
// rhythm instead of a scroll lottery. Callers pass a `key` tied to the open
// step so the disclosure resets when the pane changes.
//
// It is a panel like every other section of the step, not a bordered box of
// its own on the frame's ground: the accordion brought its own card chrome
// from before the step was a frame, which left it reading grey between two
// white sections. The panel is the container now and the accordion keeps
// only its behaviour, so the trigger row and the table under it sit on the
// same white as everything else. No section title either: the trigger
// already carries one.
export function EvidenceDisclosure({
  label,
  count,
  children,
}: {
  label: string
  // The size of what is behind the disclosure (a member count), so the user
  // knows what opening it costs before they open it. Plain text, not
  // NumberFlow: it changes when the open step changes, never while the
  // reader is watching it.
  count?: number
  children: ReactNode
}) {
  return (
    // p-0 with the panel's own horizontal padding moved onto the accordion
    // item: the trigger is a full-width row, so its hover and focus ring
    // have to reach the panel's edges rather than stopping inside a second
    // inset. py-1 plus the trigger's own py-2.5 lands on the panel's
    // vertical padding, so this section measures like its neighbours.
    <FrameCardSection className="p-0">
      <Accordion>
        <AccordionSection
          value="evidence"
          title={label}
          className="px-(--frame-panel-px) py-1"
          meta={
            count === undefined ? undefined : (
              // The mark says what the number counts, so the count needs no
              // label of its own. The same people mark sits beside the
              // per-gender headcounts in the figure row above.
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={UserMultiple02Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
                {count}
              </span>
            )
          }
        >
          {children}
        </AccordionSection>
      </Accordion>
    </FrameCardSection>
  )
}
