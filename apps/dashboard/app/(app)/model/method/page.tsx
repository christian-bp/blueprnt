"use client"

import { useTranslations } from "next-intl"
import { MethodPanel } from "@/components/model/method-panel"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 3 of the model section: each criterion's rationale and bias review
// (the kriterieurvalsprotokoll) and the method appendix export built from them.
// The approval gate they feed is the next chapter's. The working-conditions
// materiality decision is NOT here: it is made in the column it is about, on
// the Kriterier chapter.
export default function ModelMethodChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("method"))
  return <MethodPanel orgId={orgId} />
}
