"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { AnalysisChapterTabs } from "./analysis-chapter-tabs"
import {
  ANALYSIS_CHAPTERS,
  chapterProgress,
  currentChapter,
} from "./analysis-chapters"
import { AnalysisSpine } from "./analysis-spine"
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
  const pathname = usePathname()
  const { queue } = usePayMappingRun()
  const active = currentChapter(pathname)
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
    <div className="space-y-4">
      {queue === null ? (
        // Content-shaped: the spine's real title (static i18n text, so it
        // renders real) with a flat track standing in for the instrument
        // opposite it, at the instrument's own width, so nothing moves when
        // the data lands. No counter beside it: the figures are exactly what
        // is still loading.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="font-semibold text-base">{t("progressLabel")}</h3>
          <div className="h-2 w-64 shrink-0 rounded-full bg-primary/12" />
        </div>
      ) : (
        <AnalysisSpine
          done={queue.progress.overall.done}
          total={queue.progress.overall.total}
          chapters={chapters ?? []}
          activeChapter={active}
        />
      )}
      {/* The tab row prints the OPEN chapter's own figures, from the same
          array the instrument above draws. Withheld while the run is loading,
          so a tab never shows a zero it is about to replace. */}
      <AnalysisChapterTabs chapters={chapters} />
      {children}
    </div>
  )
}
