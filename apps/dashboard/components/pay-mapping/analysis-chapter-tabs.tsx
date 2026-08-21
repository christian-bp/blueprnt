"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { ChapterTabs, chapterTabNumber } from "@/components/chapter-tabs"
import {
  ANALYSIS_CHAPTERS,
  chapterHref,
  currentChapter,
} from "./analysis-chapters"

// The analysis section's own chapter row. It replaces Iteration 3's
// single-open accordion, so choosing a chapter is a navigation decision rather
// than a state on one crowded surface.
//
// Four tabs, all of them work. There was briefly a fifth ("Läget") for the
// section index, but that page listed no steps: everything it carried is
// either answered by the spine above this row or has moved to the surface it
// belongs to.
//
// The row itself is the shared ChapterTabs (its underline, overflow and
// numbering are the same anatomy the model section's row draws); what stays
// here is the analysis's own registry and its own wording.
export function AnalysisChapterTabs() {
  const t = useTranslations("dashboard.payMapping.review")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const pathname = usePathname()
  const active = currentChapter(pathname)

  return (
    <ChapterTabs
      navLabel={tAnalysis("chapterNav")}
      // Its own id, distinct from the header tab rows above it and from the
      // model section's, or the stacked rows would cross-animate.
      underlineId="analysis-chapter-tab-underline"
      tabs={ANALYSIS_CHAPTERS.map((chapter, index) => ({
        key: chapter,
        // The SHORT names here, not the descriptive ones. Full titles plus
        // counts overflowed the row and read as a paragraph; the statute's own
        // terms (lika/likvärdigt arbete) are both shorter and more precise. The
        // descriptive titles stay on the chapter page, where there is room for
        // them to explain.
        //
        // Numbered, because the chapters are a sequence: the number says where
        // in the analysis a tab sits and gives the reader the same handle the
        // spine's own segments use. The format is a message rather than string
        // concatenation, so a locale can punctuate its own way.
        label: tAnalysis.rich("chapterTab", {
          position: index + 1,
          chapter: t(`chaptersShort.${chapter}`),
          num: chapterTabNumber,
        }),
        href: chapterHref(pathname, chapter),
        current: active === chapter,
      }))}
    />
  )
}
