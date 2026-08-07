"use client"

import { Accordion } from "@workspace/ui/components/accordion"
import type { ReactNode } from "react"
import { AccordionSection } from "@/components/accordion-section"

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
export function EvidenceDisclosure({
  label,
  count,
  children,
}: {
  label: string
  // The size of what is behind the disclosure (a member count), so the user
  // knows what opening it costs before they open it.
  count?: ReactNode
  children: ReactNode
}) {
  return (
    <Accordion>
      <AccordionSection
        value="evidence"
        title={label}
        meta={count}
        className="not-last:border-b-0"
      >
        {children}
      </AccordionSection>
    </Accordion>
  )
}
