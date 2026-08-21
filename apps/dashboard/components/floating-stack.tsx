"use client"

import type { ReactNode } from "react"
import { createDomSlot } from "@/components/dom-slot"

const slot = createDomSlot()

// Mounted by the section shell, above both the rail and the chapter whose
// pills fill it.
export const FloatingStackProvider = slot.Provider

// Rendered by a chapter, anywhere in its own tree: its pill appears in the
// stack above the instrument.
export function FloatingStackItem({ children }: { children: ReactNode }) {
  return <slot.Content>{children}</slot.Content>
}

// The floating rail a guided section keeps at the bottom of the viewport: the
// journey instrument at its base, and whatever a chapter has to say stacked
// above it.
//
// Bottom-CENTRE, at the same offset and the same z the chapter pills already
// used on their own, so nothing moved for anyone when the instrument joined
// them. Centre rather than a corner because what the stack carries is the
// section's whole subject, and because the toasts own the bottom-right on this
// app (z-50 against this z-40, so a toast passes over the stack rather than
// being hidden by it).
//
// The instrument is here rather than on the section's title row because it was
// the one reading a reader lost by scrolling: a section's state is what you
// check WHILE working, not something you scroll back up for. Its celebration
// follows it, which is the argument that settled the move: a burst thrown at a
// bar that is off screen is a burst nobody sees.
//
// FIXED positioning is also the collision law being satisfied rather than
// worked around: the rail is out of flow, so it cannot push a column or a row,
// and it cannot be clipped by an ancestor's overflow. What it CAN do is cover
// content at the bottom of a short viewport, so nothing here takes pointer
// events except a pill that has actually rendered: the instrument is a
// non-interactive shape and stays transparent to clicks, so the content under
// it is still reachable.
export function FloatingStack({ instrument }: { instrument: ReactNode }) {
  const ref = slot.useSlotRef()
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-4"
      data-slot="floating-stack"
    >
      {/* The pills, ABOVE the instrument. display:contents makes them direct
          flex items of the rail, so they take its gap and its order rather
          than stacking inside a wrapper of their own. */}
      <span className="contents" ref={ref} />
      {instrument}
    </div>
  )
}
