"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ChapterFraming } from "@/components/model/chapter-framing"
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
      {/* No reading cap, unlike the Godkännande chapter next door: this
          chapter is a grid of dimension columns like its other two
          neighbours, and a column is already a readable measure. */}
      <MethodPanel orgId={orgId} />
    </div>
  )
}
