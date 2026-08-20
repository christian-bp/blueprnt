"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import type { ModelChapter } from "@/lib/model-chapters"

// The one line every chapter opens with (masterdokument section 4.1): what
// this chapter decides, in the reader's own words, before it asks for
// anything.
//
// One line rather than the three-part block the single build page carried:
// the spine and the tab row above already say where in the sequence the reader
// is and what comes next, so repeating that per page was weight without a job.
//
// `help` is the chapter's own concept explainer, where the chapter is the
// first place that concept appears. At most one per chapter: a second concept's
// help belongs beside its own control, never stacked on this line.
export function ChapterFraming({
  chapter,
  help,
}: {
  chapter: ModelChapter
  help?: ReactNode
}) {
  const t = useTranslations("dashboard.model.chapters.framing")
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
      {t(chapter)}
      {help}
    </p>
  )
}
