"use client"

import { useTranslations } from "next-intl"
import type { RefObject } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"
import { SpineHeader } from "@/components/spine-header"
import type { AnalysisChapter } from "./analysis-chapters"

// Rung 0 of the analysis ladder: where the whole mapping stands, on the
// section's own title row. The same anatomy the model section draws (they
// share SpineHeader and SegmentedProgress), so the reading sits at the same
// place in both guided sections.
//
// Deliberately NOT built on WizardProgress: that component renders an
// unconditional Spinner (this is a steady state, not a running job) and clamps
// its bar monotonically, so it could never move backwards when a user undoes a
// klarmarkering.
export function AnalysisSpine({
  done,
  total,
  chapters,
  activeChapter,
  headingRef,
}: {
  done: number
  total: number
  // Each chapter's own done/total, in chapter order, for the segmented
  // instrument. Keyed by AnalysisChapter, not by a bare string, so each
  // segment's own name resolves without a cast.
  chapters: { key: AnalysisChapter; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the instrument to the tab row
  // underneath it. Optional only for the moment before a path resolves to a
  // chapter; every real page has one.
  activeChapter?: string
  // An optional programmatic focus target.
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")

  return (
    <SpineHeader
      // The heading labels the instrument; the page above already says
      // "Analysis", so a second title would only repeat it.
      heading={t("progressLabel")}
      headingRef={headingRef}
      help={
        <HelpMorphButton label={tHelp("analysisProgressLabel")}>
          {tHelp("analysisProgressBody")}
        </HelpMorphButton>
      }
      instrument={
        <SegmentedProgress
          barLabel={t("progressBarLabel")}
          done={done}
          total={total}
          segments={chapters}
          activeSegment={activeChapter}
        />
      }
    />
  )
}
