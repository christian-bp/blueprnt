"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ChapterActionSlotProvider } from "@/components/chapter-action-slot"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  PageHeaderAdornment,
  PageHeaderAside,
} from "@/components/page-header-slot"
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
  const tReview = useTranslations("dashboard.payMapping.review")
  const pathname = usePathname()
  const { queue } = usePayMappingRun()
  const active = currentChapter(pathname)
  // Each chapter's own done/total, in chapter order, for the instrument's
  // segments and the count under the open one.
  // The chapters' own SHORT names, the same ones the tab row uses, resolved
  // where the key is still typed.
  const nameFor = new Map<string, string>(
    ANALYSIS_CHAPTERS.map((chapter) => [
      chapter,
      tReview(`chaptersShort.${chapter}`),
    ])
  )
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
      <FloatingStackProvider>
        <div className="space-y-4">
          {/* The section has no title of its own any more. It had one, and
              it said "Documented", which named the section's SUBJECT beside a
              page already titled Analysis and left the reader two headings
              for one thing. Its concept help and its instrument move up to
              that page title, which is what they were always about. */}
          <PageHeaderAdornment>
            <HelpMorphButton label={tHelp("analysisProgressLabel")}>
              {tHelp("analysisProgressBody")}
            </HelpMorphButton>
          </PageHeaderAdornment>
          <PageHeaderAside>
            <SegmentedProgress
              activeSegment={active}
              barLabel={t("progressBarLabel")}
              done={queue?.progress.overall.done ?? 0}
              renderTitle={(segment) => nameFor.get(segment.key) ?? segment.key}
              renderCount={(segment) =>
                tJourney.rich("countRich", {
                  done: () => <NumberFlow value={segment.done} />,
                  total: () => <NumberFlow value={segment.total} />,
                })
              }
              segments={chapters ?? []}
              total={queue?.progress.overall.total ?? 0}
            />
          </PageHeaderAside>
          {/* The journey row: the tabs and this chapter's action. */}
          <AnalysisChapterTabs />
          {children}
        </div>
        {/* The same stack the model section keeps. This section carries no
            pills of its own today, so the rail renders nothing at all. */}
        <FloatingStack />
      </FloatingStackProvider>
    </ChapterActionSlotProvider>
  )
}
