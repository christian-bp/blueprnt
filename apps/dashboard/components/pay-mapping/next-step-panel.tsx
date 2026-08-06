"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"

// The chapters, in the checklist's own order, so the panel can say "chapter
// 3 of 4" without the caller counting.
export const ANALYSIS_CHAPTERS = [
  "start",
  "praxis",
  "equalWork",
  "equivalentWork",
] as const

export type AnalysisChapter = (typeof ANALYSIS_CHAPTERS)[number]

// The pane's landing state (rung 2, state 1): what to do next, and nothing
// else. It replaces auto-opening the first undone step, which put a chart, a
// 25-row table and a form on screen before the user had asked for anything.
// A decision, not a workload.
export function NextStepPanel({
  chapter,
  label,
  remainingAfter,
  onOpen,
}: {
  chapter: AnalysisChapter
  // The next undone step's own checklist label.
  label: string
  // How many steps remain once this one is done.
  remainingAfter: number
  onOpen: () => void
}) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tChapters = useTranslations("dashboard.payMapping.review.chapters")
  const position = ANALYSIS_CHAPTERS.indexOf(chapter) + 1

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("chapterPosition", {
          position,
          total: ANALYSIS_CHAPTERS.length,
          chapter: tChapters(chapter),
        })}
      </p>
      <div className="space-y-1">
        <p className="font-medium text-base">{t("nextStepLabel", { label })}</p>
        {/* One sentence per chapter about what the work IS, so the landing
            guides rather than merely names the next row. */}
        <p className="text-muted-foreground text-sm">
          {t(`nextAction.${chapter}`)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onOpen}>
          {t("openStep")}
        </Button>
        {remainingAfter > 0 && (
          <span className="text-muted-foreground text-sm">
            {t("remainingAfter", { count: remainingAfter })}
          </span>
        )}
      </div>
    </div>
  )
}
