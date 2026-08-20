"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { ChapterTabs, chapterTabNumber } from "@/components/chapter-tabs"
import {
  chapterHref,
  currentChapter,
  MODEL_CHAPTERS,
} from "@/lib/model-chapters"

// The model section's own chapter row: one tab per chapter, in the order the
// work is done.
//
// The row itself is the shared ChapterTabs (its underline, overflow and
// numbering are the same anatomy the kartläggning's analysis row draws); what
// stays here is the model's own registry and its own wording.
export function ModelChapterTabs() {
  const t = useTranslations("dashboard.model.chapters")
  const pathname = usePathname()
  const active = currentChapter(pathname)

  return (
    <ChapterTabs
      navLabel={t("nav")}
      // Its own id, distinct from the analysis chapter row's, or the two would
      // cross-animate their underlines.
      underlineId="model-chapter-tab-underline"
      tabs={MODEL_CHAPTERS.map((chapter, index) => ({
        key: chapter,
        // Numbered, because the chapters are a sequence: the number says where
        // in the build a tab sits and gives the reader the same handle the
        // spine's segments use. The format is a message rather than string
        // concatenation, so a locale can punctuate its own way.
        label: t.rich("tab", {
          position: index + 1,
          chapter: t(chapter),
          num: chapterTabNumber,
        }),
        href: chapterHref(chapter),
        current: active === chapter,
      }))}
    />
  )
}
