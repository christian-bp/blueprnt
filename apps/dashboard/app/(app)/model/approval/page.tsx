"use client"

import { useTranslations } from "next-intl"
import { ApprovalCard } from "@/components/model/approval-card"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 4 of the model section: the twelve-check gate, the working-conditions
// materiality decision, and the approval itself (ADR-0023). Approval is the
// sole precondition for rating a role, and a method-affecting change anywhere
// in the section falls the model back to draft, which is why this is a chapter
// of its own rather than a footer on the method page. No help on the framing
// line: the approval concept's explainer sits on the card's own title.
export default function ModelApprovalChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("approval"))
  return (
    <div className="space-y-4">
      <ChapterFraming chapter="approval" />
      <ApprovalCard orgId={orgId} />
    </div>
  )
}
