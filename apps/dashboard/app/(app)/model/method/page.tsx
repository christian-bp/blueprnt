"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { MethodPanel } from "@/components/model/method-panel"
import { WorkingConditionsSection } from "@/components/model/working-conditions-section"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 3 of the model section: each criterion's rationale and bias review
// (the kriterieurvalsprotokoll), the working-conditions materiality decision,
// and the method appendix export built from them. The approval gate they feed
// is the next chapter's.
export default function ModelMethodChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(tChapters("method"))
  return (
    <div className="space-y-4">
      <ChapterFraming
        chapter="method"
        help={
          <HelpMorphButton label={tHelp("methodAppendixLabel")}>
            {tHelp("methodAppendixBody")}
          </HelpMorphButton>
        }
      />
      {/* max-w-4xl on the CONTENT only, not on the framing line above it: the
          chapter's chrome (spine, tab row, framing) stays the same width on
          all four chapters, and only the part that is prose stops stretching.
          Left-aligned, never centered, so the section keeps one left edge.
          4xl rather than 5xl because a criterion row spends a fixed 13rem on
          its status and action slot, so at 56rem the flexible name and
          description column lands near the readable measure; at 5xl the
          descriptions run past it and gain nothing. */}
      <div className="max-w-4xl space-y-4">
        <MethodPanel orgId={orgId} />
        {/* Below the documentation it belongs with: it is method
            documentation, and the spine counts it as this chapter's work. */}
        <WorkingConditionsSection orgId={orgId} />
      </div>
    </div>
  )
}
