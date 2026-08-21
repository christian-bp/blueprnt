"use client"

import { useTranslations } from "next-intl"
import { WeightingChapter } from "@/components/model/weighting-chapter"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 2 of the model section: how much each chosen criterion counts
// (ADR-0004: 1-5 weight points under a fixed budget, never a free percentage).
// The framing row, its AI review trigger and the floating budget pill all
// belong to the chapter component, which is where the draft allocation they
// depend on lives.
export default function ModelWeightingChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("weighting"))
  return <WeightingChapter orgId={orgId} />
}
