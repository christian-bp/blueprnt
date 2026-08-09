"use client"

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"
import {
  ANALYSIS_CHAPTERS,
  chapterHref,
  chapterProgress,
  currentChapter,
} from "./analysis-chapters"
import { usePayMappingRun } from "./pay-mapping-run-context"

// The analysis section's own row: one tab per chapter. It replaces
// Iteration 3's single-open accordion, so choosing a chapter is a
// navigation decision rather than a state on one crowded surface.
//
// Four tabs, all of them work. There was briefly a fifth ("Läget") for the
// section index, but that page listed no steps: everything it carried is
// either answered by the spine above this row or has moved to the surface
// it belongs to.
//
// Same anatomy as PayMappingTabs (a nav, aria-current="page", a layoutId
// underline) with its own layoutId, or the two stacked rows would
// cross-animate into each other. Unlike its parent, each tab carries its
// chapter's own progress: the row is a status readout as well as a
// switcher, which is the job the accordion's chapter headers were doing.
export function AnalysisChapterTabs() {
  const t = useTranslations("dashboard.payMapping.review")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const pathname = usePathname()
  const { queue } = usePayMappingRun()
  const active = currentChapter(pathname)

  const tabs = ANALYSIS_CHAPTERS.map((chapter, index) => {
    // The queue is null until the run's queries resolve; the labels are
    // static i18n text, so the row renders real and only the counts wait.
    const progress =
      queue === null ? undefined : chapterProgress(queue, chapter)
    const done =
      progress !== undefined &&
      progress.total > 0 &&
      progress.done === progress.total
    return {
      key: chapter,
      done,
      // The SHORT names here, not the descriptive ones. Full titles
      // plus counts overflowed the row and read as a paragraph; the
      // statute's own terms (lika/likvärdigt arbete) are both shorter and
      // more precise. The descriptive titles stay on the chapter page,
      // where there is room for them to explain.
      //
      // Numbered, because the chapters are a sequence: the number says
      // where in the analysis a tab sits and gives the reader the same
      // handle the chapter's own bar uses ("Chapter 2 of 4"). The format is
      // a message rather than string concatenation, so a locale can punctuate
      // its own way.
      label: tAnalysis("chapterTab", {
        position: index + 1,
        chapter: t(`chaptersShort.${chapter}`),
      }),
      href: chapterHref(pathname, chapter),

      current: active === chapter,
    }
  })

  return (
    <nav
      aria-label={tAnalysis("chapterNav")}
      className="-mx-1 flex items-stretch gap-1 overflow-x-auto"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 py-2 font-medium text-sm transition-colors ${
            tab.current
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {/* The slot is always there and only the mark inside it fades in.
              Rendering the icon conditionally widened the tab by its own size
              plus the row's gap the moment a chapter finished, pushing that
              tab's label and every tab after it sideways: on load, when every
              done mark arrives at once, and again live when the last step of
              a chapter is documented. */}
          <span
            aria-hidden="true"
            className={`size-3.5 shrink-0 text-muted-foreground transition-opacity ${
              tab.done ? "opacity-100" : "opacity-0"
            }`}
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
              className="size-3.5"
            />
          </span>
          {/* The mark replaces a count a screen reader could read, so the
              state has to survive as text. Same wording as the checklist rows
              use for a documented step. */}
          {tab.done && <span className="sr-only">{t("status.done")}</span>}
          {tab.label}
          {tab.current && (
            <motion.span
              layoutId="analysis-chapter-tab-underline"
              transition={SPRING}
              className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground"
            />
          )}
        </Link>
      ))}
    </nav>
  )
}
