"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import type { ReactNode, RefObject } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"

// Rung 0 of the analysis ladder: where the whole mapping stands, in one
// line, above everything else on the page. Deliberately NOT built on
// WizardProgress: that component renders an unconditional Spinner (this is a
// steady state, not a running job) and clamps its bar monotonically, so it
// could never move backwards when a user undoes a klarmarkering.
export function AnalysisSpine({
  done,
  total,
  chapters,
  activeChapter,
  headingRef,
  right,
}: {
  done: number
  total: number
  // Each chapter's own done/total, in chapter order, for the segmented
  // bar below.
  chapters: { key: string; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the bar to the tab row
  // underneath it. Optional only for the moment before a path resolves to
  // a chapter; every real page has one.
  activeChapter?: string
  // An optional programmatic focus target.
  headingRef?: RefObject<HTMLHeadingElement | null>
  // Optional trailing slot on the heading row.
  right?: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")
  const tJourney = useTranslations("dashboard.payMapping.journey")

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* The heading labels the bar; the page above already says
              "Analysis", so a second title would only repeat it.
              outline-none because this is a programmatic focus target only,
              never reachable by Tab.

              The overall count used to sit here as a second figure. Two
              unlabelled pairs of numbers a line apart (the total, then the
              open chapter's own) read as clutter, and the total is on the
              run's Overview, where finishing lives. It survives as text for
              a screen reader, because the per-chapter figure below is
              aria-hidden and the bar alone would only announce a
              percentage. */}
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-semibold text-base outline-none"
          >
            {t("progressLabel")}
            <span className="sr-only">
              {" "}
              {tJourney("count", { done, total })}
            </span>
          </h3>
          <HelpMorphButton label={tHelp("analysisProgressLabel")}>
            {tHelp("analysisProgressBody")}
          </HelpMorphButton>
        </div>
        {right}
      </div>
      {/* The bar itself is the shared journey primitive (its geometry, its
          fill rule and its count row are the same anatomy the model section
          draws, equally wide chapters included); what stays here is the
          mapping's own wording. */}
      <SegmentedProgress
        barLabel={t("progressBarLabel")}
        done={done}
        total={total}
        segments={chapters}
        activeSegment={activeChapter}
        renderCount={(segment) =>
          tJourney.rich("countRich", {
            done: () => <NumberFlow value={segment.done} />,
            total: () => <NumberFlow value={segment.total} />,
          })
        }
      />
    </section>
  )
}
