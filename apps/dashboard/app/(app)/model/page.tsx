"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ModelBuilder } from "@/components/model/model-builder"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The model's Criteria page (the Define phase): the library selection grouped
// into its four dimension sections, each with its own picker (ADR-0021
// addendum, decision 8: there is no free-text criterion editor left, only a
// library to select from). Weighting lives on its own page (/model/weighting),
// reached via the header ModelTabs, so the role-facing 0-5 scale and the
// model-facing 1-5 weighting are never shown together.
export default function ModelCriteriaPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.tabs")
  const tHelp = useTranslations("dashboard.help")
  const tBuilder = useTranslations("dashboard.model.builder")
  usePageTitle(t("criteria"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("criteria")}
        titleAdornment={
          <HelpMorphButton label={tHelp("criterionLabel")}>
            {tHelp("criterionBody")}
          </HelpMorphButton>
        }
        description={tBuilder("defineDescription")}
      />
      <ModelBuilder orgId={orgId} phase="define" />
    </div>
  )
}
