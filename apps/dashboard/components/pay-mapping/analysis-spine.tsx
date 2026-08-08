"use client"

import NumberFlow from "@number-flow/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import type { ReactNode, RefObject } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// Rung 0 of the analysis ladder: where the whole mapping stands, in one
// line, above everything else on the page. Deliberately NOT built on
// WizardProgress: that component renders an unconditional Spinner (this is a
// steady state, not a running job) and clamps its bar monotonically, so it
// could never move backwards when a user undoes a klarmarkering.
export function AnalysisSpine({
  done,
  total,
  chapters,
  activeChapter,
  headingRef,
  right,
}: {
  done: number
  total: number
  // Each chapter's own done/total, in chapter order, for the segmented
  // bar below.
  chapters: { key: string; done: number; total: number }[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the bar to the tab row
  // underneath it. Optional only for the moment before a path resolves to
  // a chapter; every real page has one.
  activeChapter?: string
  // An optional programmatic focus target.
  headingRef?: RefObject<HTMLHeadingElement | null>
  // Optional trailing slot on the heading row.
  right?: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* The heading labels the bar; the page above already says
              "Analysis", so a second title would only repeat it.
              outline-none because this is a programmatic focus target only,
              never reachable by Tab.

              The overall count used to sit here as a second figure. Two
              unlabelled pairs of numbers a line apart (the total, then the
              open chapter's own) read as clutter, and the total is on the
              run's Overview, where finishing lives. It survives as text for
              a screen reader, because the per-chapter figure below is
              aria-hidden and the bar alone would only announce a
              percentage. */}
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-semibold text-base outline-none"
          >
            {t("progressLabel")}
            <span className="sr-only">
              {" "}
              {tJourney("count", { done, total })}
            </span>
          </h3>
          <HelpMorphButton label={tHelp("analysisProgressLabel")}>
            {tHelp("analysisProgressBody")}
          </HelpMorphButton>
        </div>
        {right}
      </div>
      {/* One bar, split into the four chapters and weighted by how much
          work each one holds. A single undivided bar left the shape of the
          work invisible: in a real run one chapter carries 21 of the 29 steps,
          so its segment is most of the bar and that is the honest picture.
          Equal-width segments would read "2 of 4 chapters done" as halfway
          when it is a sixth of the work.

          The bar always shows the WHOLE mapping, whichever page you are
          on, so its accessible name says so rather than borrowing the
          heading's. */}
      <div className="space-y-1">
        <div
          role="progressbar"
          aria-label={t("progressBarLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="flex h-2 w-full gap-0.5 rounded-full"
        >
          {chapters.map((chapterProgress) => (
            <div
              key={chapterProgress.key}
              // The bar's segments and the tab row can never line up:
              // segments are weighted by how much work a chapter holds,
              // tabs by how long their names are. Simultaneous
              // highlighting is what links them instead. With no active
              // chapter the whole bar reads at full strength.
              data-active={
                activeChapter === undefined ||
                activeChapter === chapterProgress.key
              }
              style={{
                flexGrow: Math.max(chapterProgress.total, 0),
                flexBasis: "0.75rem",
              }}
              // The dimming rides on the FILL, never on the track: the
              // track is "work not yet done" and that reads the same in
              // every chapter, so fading it made the open chapter's
              // remainder a different colour from everyone else's for no
              // reason. Only the done part recedes.
              // The track sits at 12% and a receded fill at 45%, so "done"
              // reads as done even in a chapter you are not on. At 20/35 the
              // two were only 1.75x apart and a finished chapter looked
              // untouched. The track still has to be visible: it is the
              // only hint of how big a chapter is before you start it, so
              // it stays a wash rather than disappearing into the card.
              className="group/segment h-full overflow-hidden rounded-full bg-primary/12"
            >
              <div
                className="h-full rounded-full bg-primary opacity-45 transition-[width,opacity] duration-500 group-data-[active=true]/segment:opacity-100"
                style={{
                  width:
                    chapterProgress.total <= 0
                      ? "0%"
                      : `${Math.round((chapterProgress.done / chapterProgress.total) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        {/* The open chapter's own count, under its own segment. Mirrors the
            bar's flex weights so the figure sits beneath the part of the
            bar it describes, which is what makes "1 of 3" mean this
            chapter rather than the mapping. The only count on this surface
            now: it is the one the reader is working in. Reserved height, so
            lighting up a chapter never reflows the page (the
            no-layout-shift rule). */}
        <div aria-hidden="true" className="flex h-4 w-full gap-0.5">
          {chapters.map((chapterProgress) => (
            <div
              key={chapterProgress.key}
              style={{
                flexGrow: Math.max(chapterProgress.total, 0),
                flexBasis: "0.75rem",
              }}
              className="relative h-full"
            >
              <AnimatePresence>
                {activeChapter === chapterProgress.key && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={SPRING}
                    className="absolute top-0 left-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
                  >
                    {tJourney.rich("countRich", {
                      done: () => <NumberFlow value={chapterProgress.done} />,
                      total: () => <NumberFlow value={chapterProgress.total} />,
                    })}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
