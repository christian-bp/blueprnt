"use client"

import { MIN_CRITERIA } from "@workspace/core"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { AddCriterionDialog } from "@/components/model/add-criterion-dialog"
import { ModelBuilder } from "@/components/model/model-builder"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The model's Criteria page (the Define phase): identity + the 0-5 evaluation
// scale. Weighting lives on its own page (/model/weighting), reached via the
// header ModelTabs, so the role-facing 0-5 scale and the model-facing 1-5
// weighting are never shown together. Removal hides at MIN_CRITERIA (a finished
// model never drops below the composition floor).
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
        action={<AddCriterionDialog orgId={orgId} />}
      />
      <ModelBuilder orgId={orgId} phase="define" removalFloor={MIN_CRITERIA} />
    </div>
  )
}
