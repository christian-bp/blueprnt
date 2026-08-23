"use client"

import { cn } from "@workspace/ui/lib/utils"
import { type ComponentProps, type ReactNode, useId } from "react"

// The box every dimension column is drawn in, on every chapter of the model
// section: the dashed card, its heading row, and the body under it.
//
// Dashed rather than solid because the border is a promise about the box: a
// dashed outline is the app's (and the wider convention's) way of saying "this
// container takes something", and four of them read as one row of slots rather
// than four cards that happen to be empty. The chapters differ only in what
// they put IN the heading row (a count chip on Kriterier, the dimension's
// share on Viktning, the name alone on Metod) and in what they put in the
// body, so the frame itself is declared once here: a later tweak to the
// border, the padding or the heading row lands on all three at once instead of
// being applied to two of them and forgotten on the third.
//
// A section rather than a div with role="group": it is a titled part of the
// page holding its own content, which is what a section is, and naming it
// makes it a place a screen reader can jump straight to, which on a
// four-column surface is how the reader gets to their dimension.
export function DimensionFrame({
  heading,
  headingId,
  footer,
  className,
  children,
  ...section
}: {
  // The heading row's content: a heading element, plus whatever the chapter's
  // own lens puts beside it.
  heading: ReactNode
  // The id of the element inside `heading` that NAMES this column, where the
  // caller has one to point at. Kriterier does: its heading row carries a help
  // trigger beside the title, and a name taken from the whole row would read
  // the trigger out as part of the dimension's name. Without it the frame
  // names itself after the heading row, which is right where the row is the
  // title and nothing else.
  headingId?: string
  // A last row inside the frame, under the body: today only the Kriterier
  // column's add row, which belongs inside the box because adding is that
  // column's own work.
  footer?: ReactNode
  children: ReactNode
} & Omit<ComponentProps<"section">, "children">) {
  const generatedId = useId()
  const nameId = headingId ?? generatedId
  return (
    <section
      {...section}
      // The house convention for "this is the shared thing", and what lets a
      // chapter's own test assert that its columns are drawn in this frame
      // without repeating the frame's classes in a third file.
      data-slot="dimension-frame"
      aria-labelledby={nameId}
      // The kanban-column frame (the register frames one level down): a muted
      // outer wrap whose white cards are the criteria.
      className={cn(
        "flex flex-col rounded-xl border bg-muted/50 bg-clip-padding p-1",
        className
      )}
    >
      <div
        id={headingId === undefined ? nameId : undefined}
        className="flex min-h-9 items-center justify-between gap-2 px-2 py-1.5"
      >
        {heading}
      </div>
      {/* relative: a column whose content leaves through AnimatePresence's
          popLayout needs a positioned ancestor to take it out of flow
          against. */}
      <div className="relative p-0.5">{children}</div>
      {footer !== undefined && <div className="p-0.5 pt-1.5">{footer}</div>}
    </section>
  )
}
