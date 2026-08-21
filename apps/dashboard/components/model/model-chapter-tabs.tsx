"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { ChapterTabs, chapterTabNumber } from "@/components/chapter-tabs"
import {
  chapterHref,
  currentChapter,
  MODEL_CHAPTERS,
  type ModelChapter,
} from "@/lib/model-chapters"

// The model section's own chapter row: one tab per chapter, in the order the
// work is done.
//
// The row itself is the shared ChapterTabs (its underline, overflow and
// numbering are the same anatomy the kartläggning's analysis row draws); what
// stays here is the model's own registry and its own wording.
export function ModelChapterTabs({
  chapters,
}: {
  // Each chapter's own done/total, in chapter order: the SAME array the spine
  // above draws its segments from, passed down by the section shell rather
  // than derived a second time here, so the tab and the segment above it can
  // never disagree about the chapter they both describe. Absent while the
  // section's progress query is still in flight.
  chapters?: readonly { key: ModelChapter; done: number; total: number }[]
}) {
  const t = useTranslations("dashboard.model.chapters")
  const pathname = usePathname()
  const active = currentChapter(pathname)
  const progressFor = new Map(
    (chapters ?? []).map((chapter) => [chapter.key, chapter])
  )
  // The chapter's own figures, as the section's own message. Both numbers move
  // while the reader works inside the chapter, so the message is tag-based and
  // each carries NumberFlow rather than the pair swapping in place.
  const countFor = (chapter: ModelChapter) => {
    const progress = progressFor.get(chapter)
    return progress === undefined
      ? undefined
      : t.rich("countRich", {
          done: () => <NumberFlow value={progress.done} />,
          total: () => <NumberFlow value={progress.total} />,
        })
  }

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
        count: countFor(chapter),
      }))}
    />
  )
}
