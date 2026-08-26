"use client"

import type { ReactNode } from "react"
import { createDomSlot } from "@/components/dom-slot"

// A guided section's chapter ACTION lands on the section's own action row,
// but it belongs to the chapter: whether Viktning offers its AI review needs
// that chapter's own model and review lock, and Metod's export loads its own
// data. The row is section chrome mounted once by the layout, above the
// chapter that is only its child.
//
// So the action travels rather than the state: the chapter renders its own
// control in its own React tree, where its hooks and data already are, and
// this portals the resulting DOM up into the row.
const slot = createDomSlot()

// The size EVERY chapter action takes. One size across a section, owned by
// the slot they all land in rather than chosen per chapter: the actions sit
// at the same place on every chapter, and a reader moving between them should
// not meet a control that changes height as they go. Nova's sm, deliberately:
// these are compact in-row controls, the surface the style's sm size exists
// for.
export const CHAPTER_ACTION_BUTTON_SIZE = "sm" as const

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

// The section's action row, mounted by both guided-section shells between the
// title row and the chapter body. It used to be the right side of the chapter
// tab row; the chapters navigate from the sidebar now, and this row is what
// remains of that band. min-h-7 is the action button's height, held whether
// or not a chapter offers one, so the content below starts at the same Y on
// every chapter and switching chapters holds the columns still.
export function ChapterActionRow() {
  return (
    <div className="flex min-h-7 items-center">
      <ChapterActionSlot />
    </div>
  )
}
