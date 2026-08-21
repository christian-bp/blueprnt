"use client"

import type { ReactNode } from "react"
import { createDomSlot } from "@/components/dom-slot"

// A guided section's chapter ACTION lands on the journey row, beside the tabs,
// but it belongs to the chapter: whether Viktning offers its AI review needs
// that chapter's own model and review lock, and Metod's export loads its own
// data. The row is section chrome mounted once by the layout, above the
// chapter that is only its child.
//
// So the action travels rather than the state: the chapter renders its own
// control in its own React tree, where its hooks and data already are, and
// this portals the resulting DOM up into the row.
const slot = createDomSlot()

// Mounted by the section shell, above both the journey row and the chapter.
export const ChapterActionSlotProvider = slot.Provider

// The box the actions land in, rendered by the journey row. Always present,
// never conditional: it is what keeps the row the same height on a chapter
// that offers no action as on one that does.
export function ChapterActionSlot() {
  const ref = slot.useSlotRef()
  return (
    // Named, so the size rule has something a test can hold it to: every
    // control in this slot is a chapter action, whichever chapter put it
    // there. ms-auto is the row's ONE auto margin, which is what holds the
    // slot against the right edge whether or not a chapter fills it.
    <span
      className="ms-auto flex shrink-0 items-center gap-2"
      data-slot="chapter-action"
      ref={ref}
    />
  )
}

// Rendered by a chapter, anywhere in its own tree: its control appears in the
// row above.
export function ChapterAction({ children }: { children: ReactNode }) {
  return <slot.Content>{children}</slot.Content>
}
