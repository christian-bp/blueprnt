"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SegmentedProgress } from "@/components/segmented-progress"
import { SpineHeader } from "@/components/spine-header"
import type { ModelChapter } from "@/lib/model-chapters"

// Where the whole model stands, on the section's own title row. The same
// anatomy the kartläggning's analysis spine draws (they share SpineHeader and
// SegmentedProgress), so a user who has met one guided section already knows
// where to look in the other.
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
  // Keyed by ModelChapter, not by a bare string, so each segment's own name
  // resolves without a cast.
  chapters: { key: ModelChapter; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the instrument to the tab row
  // underneath it.
  activeChapter?: string
}) {
  const t = useTranslations("dashboard.model.chapters")
  const tHelp = useTranslations("dashboard.help")
  // The chapters' own names, resolved where the key is still typed. They are
  // the hover's, not the instrument's: the tab row under the title is what
  // names the chapters on screen.
  const segments = chapters.map((chapter) => ({
    ...chapter,
    name: t(chapter.key),
  }))

  return (
    <SpineHeader
      // The heading names what the section is BUILDING, not how far along it
      // is: the instrument opposite it is the progress reading, and an
      // abstract progress word here said the same thing twice while naming
      // nothing.
      heading={t("heading")}
      help={
        <HelpMorphButton label={tHelp("modelProgressLabel")}>
          {tHelp("modelProgressBody")}
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
            // A chapter reaching its own done/total plays the same
            // celebration a finished to-do card does. The kartläggning's
            // analysis spine does not opt in.
            celebrateOnComplete
            renderCount={(segment) =>
              t.rich("countRich", {
                done: () => <NumberFlow value={segment.done} />,
                total: () => <NumberFlow value={segment.total} />,
              })
            }
          />
          {/* The journey's own figures, beside the instrument that draws
              them, so eye and ear agree: these are the same work units the
              announced percentage is computed from. Both numbers move while
              the reader works, so the message is tag-based and each one
              carries NumberFlow rather than swapping in place. The section's
              own countRich, not a second message saying the same thing. */}
          <span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
            {t.rich("countRich", {
              done: () => <NumberFlow value={done} />,
              total: () => <NumberFlow value={total} />,
            })}
          </span>
        </>
      }
    />
  )
}
