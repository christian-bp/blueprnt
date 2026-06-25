"use client"

import { MIN_CRITERIA } from "@workspace/core"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { AddCriterionDialog } from "@/components/model/add-criterion-dialog"
import { ModelBuilder } from "@/components/model/model-builder"
import { useOrganization } from "@/components/org-context"
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
  usePageTitle(t("criteria"))
  return (
    <div className="space-y-4">
      {/* Heading + concept help on the left, the standalone Add action on the
          right, the same header layout as "Add role" on the roles page. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-medium text-lg">{t("criteria")}</h2>
          <HelpMorphButton label={tHelp("criterionLabel")}>
            {tHelp("criterionBody")}
          </HelpMorphButton>
        </div>
        <AddCriterionDialog orgId={orgId} />
      </div>
      <ModelBuilder orgId={orgId} phase="define" removalFloor={MIN_CRITERIA} />
    </div>
  )
}
