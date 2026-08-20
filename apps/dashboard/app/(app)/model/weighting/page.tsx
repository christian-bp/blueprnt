"use client"

import { useTranslations } from "next-intl"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { WeightingChapter } from "@/components/model/weighting-chapter"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 2 of the model section: how much each chosen criterion counts
// (ADR-0004: 1-5 weight points under a fixed budget, never a free percentage).
// No help on the framing line: the weighting concept's own explainer sits on
// the budget bar, with the control it is about.
export default function ModelWeightingChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("weighting"))
  return (
    <div className="space-y-4">
      <ChapterFraming chapter="weighting" />
      <WeightingChapter orgId={orgId} />
    </div>
  )
}
