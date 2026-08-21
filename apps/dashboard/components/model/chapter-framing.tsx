"use client"

import type { ReactNode } from "react"

// The size EVERY chapter action takes. One size across the section, owned by
// the row they all sit in rather than chosen per chapter: the actions sit at
// the same place on four chapters, and a reader moving between them should not
// meet a control that changes height as they go. It is the design system's
// DEFAULT, because nothing about this row is a reason to deviate from it (the
// house rule: never hand-pick a size per call site). Viktning's actions had
// drifted to `sm` while Metod's export stayed at the default; a new chapter
// passes this rather than picking again.
export const CHAPTER_ACTION_BUTTON_SIZE = "default" as const

// The one row every chapter opens with: the chapter's own ACTION, and nothing
// else. Nothing stands between it and the chapter's content, so the four
// chapters' grids all begin at the same height and switching chapters holds
// the columns still.
//
// That stillness is why the row keeps a MINIMUM height rather than growing
// around whatever it holds: two of the four chapters offer no action, and a
// row that collapsed there would lift its grid a control's worth above the
// other two. The height is the action's, so the row measures the same on all
// four chapters whether or not one is offered.
//
// It carried a framing sentence per chapter until the surfaces could speak for
// themselves. The sentence explained what the chapter decides, which is now
// what the chapter SHOWS: the spine names it and marks it current, the columns
// carry their own titles and counts, and the checklist states its own
// verdicts. A permanent sentence restating that is prose the reader has to
// pass through on every visit to reach the work.
//
// It is rendered by whichever surface owns the chapter's ACTION state: the two
// chapters whose action depends on their own data render it inside their
// chapter component, and a chapter with no action renders it from its page.
// Either way it is the chapter's first element.
export function ChapterFraming({
  action,
}: {
  // The chapter's own action (the method appendix export, the AI weighting
  // review). Sized by CHAPTER_ACTION_BUTTON_SIZE, whatever the chapter puts
  // here.
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-end gap-2">
      {action !== undefined && (
        // Named, so the size rule above has something a test can hold it to:
        // every control in this slot is a chapter action, whichever chapter
        // put it there.
        <span
          data-slot="chapter-action"
          className="flex shrink-0 items-center gap-2"
        >
          {action}
        </span>
      )}
    </div>
  )
}
