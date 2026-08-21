"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import type { ModelChapter } from "@/lib/model-chapters"

// The size EVERY chapter action takes. One size across the section, owned by
// the row they all sit in rather than chosen per chapter: the actions sit at
// the same place on four chapters, and a reader moving between them should not
// meet a control that changes height as they go. It is the design system's
// DEFAULT, because nothing about this row is a reason to deviate from it (the
// house rule: never hand-pick a size per call site). Viktning's actions had
// drifted to `sm` while Metod's export stayed at the default; a new chapter
// passes this rather than picking again.
export const CHAPTER_ACTION_BUTTON_SIZE = "default" as const

// The one row every chapter opens with (masterdokument section 4.1): what this
// chapter decides, in the reader's own words, and the chapter's own action
// opposite it. Nothing else stands between it and the chapter's content, so
// the four chapters' grids all begin at the same height and switching tabs
// holds the columns still.
//
// That stillness is why the row keeps a MINIMUM height rather than growing
// around whatever it holds: Kriterier has no action, and a row that shrank to
// a line of text there would lift its grid a control's worth above the other
// two. The height is the action's, so the row measures the same on all four
// chapters whether or not one is offered.
//
// One line rather than the three-part block the single build page carried: the
// spine and the tab row above already say where in the sequence the reader is
// and what comes next, so repeating that per page was weight without a job.
//
// It is rendered by whichever surface owns the chapter's ACTION state: the
// three chapters whose action depends on their own data render it inside their
// chapter component, and a chapter with no action (Godkännande) renders it
// from its page. Either way it is the chapter's first element.
//
// `help` is the chapter's own concept explainer, where the chapter is the
// first place that concept appears. At most one per chapter: a second concept's
// help belongs beside its own control, never stacked on this line.
export function ChapterFraming({
  chapter,
  help,
  action,
}: {
  chapter: ModelChapter
  help?: ReactNode
  // The chapter's own action (the method appendix export, the AI weighting
  // review). Sized by CHAPTER_ACTION_BUTTON_SIZE, whatever the chapter puts
  // here.
  action?: ReactNode
}) {
  const t = useTranslations("dashboard.model.chapters.framing")
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
      <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
        {t(chapter)}
        {help}
      </p>
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
