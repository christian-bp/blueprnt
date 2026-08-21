"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import type { RefObject } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"
import { SpineCounter, SpineHeader } from "@/components/spine-header"
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
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tReview = useTranslations("dashboard.payMapping.review")
  const tProgress = useTranslations("dashboard.progress")
  // The chapters' own names, for the hover alone: the tab row under the title
  // is what names them on screen. The SHORT names, the same ones that row
  // uses, so the two can never call the same chapter two different things.
  const segments = chapters.map((chapter) => ({
    ...chapter,
    name: tReview(`chaptersShort.${chapter.key}`),
  }))

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
        <>
          <SegmentedProgress
            barLabel={t("progressBarLabel")}
            done={done}
            total={total}
            segments={segments}
            activeSegment={activeChapter}
            renderCount={(segment) =>
              tJourney.rich("countRich", {
                done: () => <NumberFlow value={segment.done} />,
                total: () => <NumberFlow value={segment.total} />,
              })
            }
          />
          {/* The mapping's own figures, beside the instrument that draws
              them, so eye and ear agree: these are the same work units the
              announced percentage is computed from. It used to be a screen
              reader's only copy of the pair, because nothing on the surface
              showed it; now it is on screen for everyone. Both numbers move
              while the reader works, so the message is tag-based and each one
              carries NumberFlow rather than swapping in place. Once there is
              nothing left to count, the shared slot says so instead
              (SpineCounter). */}
          <SpineCounter
            doneLabel={tProgress("done")}
            done={done}
            renderCount={() =>
              tJourney.rich("countRich", {
                done: () => <NumberFlow value={done} />,
                total: () => <NumberFlow value={total} />,
              })
            }
            total={total}
          />
        </>
      }
    />
  )
}
