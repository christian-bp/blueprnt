"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"

// Where the whole model stands, in one line, above every chapter page. The
// same anatomy the kartläggning's analysis spine draws (they share
// SegmentedProgress), so a user who has met one guided section already knows
// how to read the other.
//
// Deliberately NOT built on WizardProgress: that component renders an
// unconditional Spinner (this is a steady state, not a running job) and clamps
// its bar monotonically, so it could never move backwards when a criterion is
// removed or an approval is reopened, which this section does constantly.
export function ModelSpine({
  done,
  total,
  chapters,
  activeChapter,
}: {
  done: number
  total: number
  // Each chapter's own done/total, in chapter order, for the segmented bar.
  chapters: { key: string; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the bar to the tab row
  // underneath it.
  activeChapter?: string
}) {
  const t = useTranslations("dashboard.model.chapters")
  const tHelp = useTranslations("dashboard.help")

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {/* The heading labels the bar. The overall count lives here as text
            for a screen reader only: the per-chapter figure under the bar is
            aria-hidden and the bar alone would announce a percentage, while on
            screen two unlabelled pairs of numbers a line apart read as
            clutter. */}
        <h3 className="font-semibold text-base">
          {t("progressLabel")}
          <span className="sr-only"> {t("count", { done, total })}</span>
        </h3>
        <HelpMorphButton label={tHelp("modelProgressLabel")}>
          {tHelp("modelProgressBody")}
        </HelpMorphButton>
      </div>
      <SegmentedProgress
        barLabel={t("progressBarLabel")}
        done={done}
        total={total}
        segments={chapters}
        activeSegment={activeChapter}
        renderCount={(segment) =>
          t.rich("countRich", {
            done: () => <NumberFlow value={segment.done} />,
            total: () => <NumberFlow value={segment.total} />,
          })
        }
      />
    </section>
  )
}
