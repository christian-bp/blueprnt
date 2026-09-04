"use client"

import NumberFlow from "@number-flow/react"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"
import {
  BreadcrumbAdornment,
  BreadcrumbAside,
} from "@/components/page-breadcrumb-slots"
import { SegmentedProgress } from "@/components/segmented-progress"
import { ChapterDutyHelp } from "./chapter-duty-help"
import {
  ANALYSIS_CHAPTERS,
  chapterContinuationShown,
  chapterHref,
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
  // The journey's continuation, the model section's own rule: once the OPEN
  // chapter's work is done, the page ends by naming the next chapter, so
  // finishing a station never leaves the reader to work out from the sidebar
  // where the review goes on. Only on a finished chapter, only while a next
  // exists (Likvärdigt arbete is the analysis's end), and only once the queue
  // is real, so a still-loading chapter never flashes it.
  const activeIndex =
    active === undefined ? -1 : ANALYSIS_CHAPTERS.indexOf(active)
  const nextChapter =
    activeIndex === -1 ? undefined : ANALYSIS_CHAPTERS[activeIndex + 1]
  // The one derivation, shared with the steps themselves: an open step drops
  // its own primary action exactly when this link appears.
  const showContinuation = chapterContinuationShown(queue, active)

  return (
    // No chapter-action machinery here: unlike the model section, none of the
    // analysis chapters carries an action, so the provider and its band were
    // a held strip of air between the title row and every chapter's content.
    <FloatingStackProvider>
      <div className="space-y-4">
        {/* The section has no title of its own any more. It had one, and
              it said "Documented", which named the section's SUBJECT beside a
              page already titled Analysis and left the reader two headings
              for one thing. Its concept help and its instrument move up to
              that page title, which is what they were always about.

              The chapter's statutory duty rides HERE rather than on each
              step: the duty is the same for every step of a chapter, so on
              the steps it was the same popover repeated five times, and the
              trail's last crumb is the chapter it explains. */}
        {active !== undefined && (
          <BreadcrumbAdornment>
            <ChapterDutyHelp chapter={active} />
          </BreadcrumbAdornment>
        )}
        <BreadcrumbAside>
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
        </BreadcrumbAside>
        {children}
        {showContinuation && nextChapter !== undefined && (
          <div className="flex justify-end">
            <Link
              href={chapterHref(pathname, nextChapter)}
              className={cn(buttonVariants())}
            >
              {tJourney("nextCta", {
                chapter: nameFor.get(nextChapter) ?? nextChapter,
              })}
            </Link>
          </div>
        )}
      </div>
      {/* The same stack the model section keeps. This section carries no
            pills of its own today, so the rail renders nothing at all. */}
      <FloatingStack />
    </FloatingStackProvider>
  )
}
