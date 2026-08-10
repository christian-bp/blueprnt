"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"
import {
  ANALYSIS_CHAPTERS,
  chapterHref,
  currentChapter,
} from "./analysis-chapters"

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
// cross-animate into each other, and like its parent it is a switcher and
// nothing else. It carried a done mark per chapter for a while; the spine
// directly above already draws every chapter's progress as its own segment,
// so the mark repeated that reading in a coarser form and cost the row an
// icon slot it had to keep empty on every unfinished chapter.
export function AnalysisChapterTabs() {
  const t = useTranslations("dashboard.payMapping.review")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const pathname = usePathname()
  const active = currentChapter(pathname)

  const tabs = ANALYSIS_CHAPTERS.map((chapter, index) => {
    return {
      key: chapter,
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
      label: tAnalysis.rich("chapterTab", {
        position: index + 1,
        chapter: t(`chaptersShort.${chapter}`),
        // The position recedes: four numbers at full strength compete with the
        // four names for the same glance, and the name is what the reader is
        // choosing between. Muted in every state, so an active or hovered tab
        // reads the same way as the rest of the row.
        num: (chunks) => (
          <span className="text-muted-foreground">{chunks}</span>
        ),
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
          className={`relative flex shrink-0 items-center whitespace-nowrap px-2 py-2 font-medium text-sm transition-colors ${
            tab.current
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {/* inset-x-2 is the label's own box, because the tab holds nothing
              but its label: the bar hugs the text, exactly as it does in
              PayMappingTabs above. While a done mark's slot sat in front of
              the label, this same rule left the bar running 20px past the
              start of the text on every chapter that was not yet finished,
              with nothing above that stretch. Keep the tab a label and this
              stays true; put anything beside the label again and the bar has
              to be anchored to the label itself. */}
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
