"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"
import type { ModelChapter } from "@/lib/model-chapters"

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
  // Keyed by ModelChapter, not by a bare string, so the count row can resolve
  // each chapter's own label without a cast.
  chapters: { key: ModelChapter; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the bar to the tab row
  // underneath it.
  activeChapter?: string
}) {
  const t = useTranslations("dashboard.model.chapters")
  const tHelp = useTranslations("dashboard.help")
  // The chapters' own labels, resolved where the key is still typed. The count
  // row gets a plain ProgressSegment back from the shared bar (its key is a
  // string there, because the kartläggning's chapters are not this section's),
  // so the lookup happens against the same array that drew the segments; a
  // miss falls back to the key rather than to an empty name, which would leave
  // a bare separator hanging in front of the figures.
  const labelFor = new Map<string, string>(
    chapters.map((chapter) => [chapter.key, t(chapter.key)])
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {/* The heading names what the section is BUILDING, not how far along
            it is: the bar directly below and its per-chapter counts are the
            progress reading, and an abstract progress word above them said the
            same thing twice while naming nothing. The overall count lives here
            as text for a screen reader only: the per-chapter figure under the
            bar is aria-hidden and the bar alone would announce a percentage,
            while on screen two unlabelled pairs of numbers a line apart read
            as clutter. */}
        <h3 className="font-semibold text-base">
          {t("heading")}
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
        // EXPERIMENT A: the open chapter's NAME sits ABOVE the bar, over its
        // own segment, and the count keeps the mirror position below it. Both
        // ride the shared bar's per-section callbacks, so the kartläggning's
        // spine renders neither and stays exactly as it was.
        renderTitle={(segment) => labelFor.get(segment.key) ?? segment.key}
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
