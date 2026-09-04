"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import type { AnalysisChapter } from "./analysis-chapters"

// What the law asks for in this chapter, one click from the step where the
// duty is actually discharged.
//
// The statutory duty sits in the help rather than on the page because the
// step already carries a question and a form; a permanent third sentence
// above every step would trade the calm this whole rework is for. It rides
// on the step's own title (the help-placement rule), never on a line of its
// own: the chapter is already named by the breadcrumb, the sidebar and the
// progress instrument, so a fourth copy of the name carried nothing but the
// help itself.
export function ChapterDutyHelp({ chapter }: { chapter: AnalysisChapter }) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tIntro = useTranslations("dashboard.payMapping.review.chapters.intro")
  // The two statutory chapters already carry a method explanation; start
  // and praxis get their own, so all four read the same way.
  const method =
    chapter === "equalWork" || chapter === "equivalentWork"
      ? tIntro(`${chapter}.body`)
      : t(`dutyHelp.${chapter}`)

  // The panel's own title is a NAME, not the duty sentence: HelpMorphButton
  // renders the label as the panel's heading and as the trigger's accessible
  // name, so passing the sentence printed it twice and made the icon button's
  // name a whole sentence.
  return (
    <HelpMorphButton label={t("dutyLabel")}>
      <span className="space-y-2">
        <span className="block">{t(`duty.${chapter}`)}</span>
        <span className="block">{method}</span>
      </span>
    </HelpMorphButton>
  )
}
