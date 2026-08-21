"use client"

import { useTranslations } from "next-intl"
import { CriteriaChapter } from "@/components/model/criteria-chapter"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 1 of the model section: which criteria the company's model is built
// from (ADR-0021 addendum, decision 8: there is no free-text criterion editor,
// only a library to choose from). The layout above carries the spine and the
// chapter tab row; this page carries only this chapter's own work, framing row
// included, because the row belongs to the surface whose state its action
// depends on and every chapter draws it the same way.
export default function ModelCriteriaChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("criteria"))
  return <CriteriaChapter orgId={orgId} />
}
