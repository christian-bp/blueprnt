"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ANALYSIS_CHAPTERS, type AnalysisChapter } from "./next-step-panel"

// The one line above an opened step: which chapter this is, and one click
// away, what the law actually asks for here.
//
// The statutory duty sits in the help rather than on the page because the
// step already carries a finding sentence and a form; a permanent third
// sentence above every step would trade the calm this whole rework is for.
// The chapter intros used to say this once, at the top of a chapter the
// user met three weeks ago, which is not where the duty gets discharged.
export function ChapterBar({ chapter }: { chapter: AnalysisChapter }) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tChapters = useTranslations("dashboard.payMapping.review.chapters")
  const tIntro = useTranslations("dashboard.payMapping.review.chapters.intro")
  const position = ANALYSIS_CHAPTERS.indexOf(chapter) + 1
  // The two statutory chapters already carry a method explanation; start
  // and praxis get their own, so all four read the same way.
  const method =
    chapter === "equalWork" || chapter === "equivalentWork"
      ? tIntro(`${chapter}.body`)
      : t(`dutyHelp.${chapter}`)

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
      {t("chapterOf", {
        position,
        total: ANALYSIS_CHAPTERS.length,
        chapter: tChapters(chapter),
      })}
      <HelpMorphButton label={t(`duty.${chapter}`)}>
        {`${t(`duty.${chapter}`)} ${method}`}
      </HelpMorphButton>
    </p>
  )
}
