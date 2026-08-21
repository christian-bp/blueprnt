"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { ChapterActionSlotProvider } from "@/components/chapter-action-slot"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SectionTitleRow } from "@/components/section-title-row"
import { AnalysisChapterTabs } from "./analysis-chapter-tabs"
import { ANALYSIS_CHAPTERS, chapterProgress } from "./analysis-chapters"

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
  const { queue } = usePayMappingRun()
  // Derived ONCE and handed to both the instrument and the tab row, so a
  // chapter's segment and its tab can never disagree about the chapter they
  // both describe.
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
        {/* The section's title and its one explainer. The reading is on the
            journey row below, with the tabs and the chapter's own action. */}
        <SectionTitleRow
          heading={t("progressLabel")}
          help={
            <HelpMorphButton label={tHelp("analysisProgressLabel")}>
              {tHelp("analysisProgressBody")}
            </HelpMorphButton>
          }
        />
        {/* The journey row: the tabs, the open chapter's own figures, the
            whole mapping's instrument, and this chapter's action. The figures
            are withheld while the run loads, so a tab never shows a zero it is
            about to replace. */}
        <AnalysisChapterTabs
          chapters={chapters}
          done={queue?.progress.overall.done ?? 0}
          total={queue?.progress.overall.total ?? 0}
        />
        {children}
      </div>
    </ChapterActionSlotProvider>
  )
}
