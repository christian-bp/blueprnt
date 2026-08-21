"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ChapterActionSlotProvider } from "@/components/chapter-action-slot"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SectionTitleRow } from "@/components/section-title-row"
import { SegmentedProgress } from "@/components/segmented-progress"
import { AnalysisChapterTabs } from "./analysis-chapter-tabs"
import {
  ANALYSIS_CHAPTERS,
  chapterProgress,
  currentChapter,
} from "./analysis-chapters"
import { usePayMappingRun } from "./pay-mapping-run-context"

// The analysis section's shared chrome, mounted by analysis/layout.tsx so it
// persists across every chapter page. The spine therefore renders ONCE for
// the whole section: never repeated per page, never re-fetched, and never
// flashing a skeleton on a chapter switch.
//
// Data comes from PayMappingRunProvider, which the run shell already mounts
// above this layout, so splitting the surface into pages adds no
// subscriptions.
//
// It carries no samverkan strip. That strip existed when all four chapters
// shared one surface and the record had nowhere else to live; samverkan is
// its own page now, showing both of its fields in full, and the chapter tab
// row already carries its done state on every page. Repeating a read-only
// copy of it above five pages was weight without a job.
export function AnalysisSectionShell({ children }: { children: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const pathname = usePathname()
  const { queue } = usePayMappingRun()
  const active = currentChapter(pathname)
  // Each chapter's own done/total, in chapter order, for the instrument's
  // segments and the count under the open one.
  const chapters =
    queue === null
      ? undefined
      : ANALYSIS_CHAPTERS.map((chapter) => ({
          key: chapter,
          ...chapterProgress(queue, chapter),
        }))

  return (
    // The chapter's own action renders inside the chapter, where its data is,
    // and lands in the tab row above it (ChapterActionSlot).
    <ChapterActionSlotProvider>
      <div className="space-y-4">
        {/* The section's title, its one explainer, and where the whole
            mapping stands, opposite it. */}
        <SectionTitleRow
          heading={t("progressLabel")}
          help={
            <HelpMorphButton label={tHelp("analysisProgressLabel")}>
              {tHelp("analysisProgressBody")}
            </HelpMorphButton>
          }
          instrument={
            <SegmentedProgress
              activeSegment={active}
              barLabel={t("progressBarLabel")}
              done={queue?.progress.overall.done ?? 0}
              renderCount={(segment) =>
                tJourney.rich("countRich", {
                  done: () => <NumberFlow value={segment.done} />,
                  total: () => <NumberFlow value={segment.total} />,
                })
              }
              segments={chapters ?? []}
              total={queue?.progress.overall.total ?? 0}
            />
          }
        />
        {/* The journey row: the tabs and this chapter's action. The open
            chapter's figures sit under the instrument above. */}
        <AnalysisChapterTabs />
        {children}
      </div>
    </ChapterActionSlotProvider>
  )
}
