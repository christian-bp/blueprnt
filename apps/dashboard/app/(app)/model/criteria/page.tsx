"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { CriteriaChapter } from "@/components/model/criteria-chapter"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 1 of the model section: which criteria the company's model is built
// from (ADR-0021 addendum, decision 8: there is no free-text criterion editor,
// only a library to choose from). The layout above carries the spine and the
// chapter tab row; this page carries only this chapter's own work.
export default function ModelCriteriaChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(tChapters("criteria"))
  return (
    <div className="space-y-4">
      <ChapterFraming
        chapter="criteria"
        help={
          // The chapter that introduces the term explains it, once.
          <HelpMorphButton label={tHelp("criterionLabel")}>
            {tHelp("criterionBody")}
          </HelpMorphButton>
        }
      />
      <CriteriaChapter orgId={orgId} />
    </div>
  )
}
