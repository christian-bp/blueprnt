"use client"

import { useTranslations } from "next-intl"
import { ApprovalCard } from "@/components/model/approval-card"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 4 of the model section: the twelve-check gate and the approval
// itself (ADR-0023). Approval is the sole precondition for rating a role, and
// a method-affecting change anywhere in the section falls the model back to
// draft, which is why this is a chapter of its own rather than a footer on the
// method page. The working-conditions materiality DECISION is made in the
// Metod chapter; what this chapter carries is the check row reporting it. No
// help on the framing line: the approval concept's explainer sits on the
// card's own title.
export default function ModelApprovalChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("approval"))
  return (
    <div className="space-y-4">
      <ChapterFraming chapter="approval" />
      {/* The same reading cap the Metod chapter takes, for the same reason:
          the checklist is twelve single lines of text, and at full viewport
          width they run as long as the page. Content only, left-aligned. */}
      <div className="max-w-4xl">
        <ApprovalCard orgId={orgId} />
      </div>
    </div>
  )
}
