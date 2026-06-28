"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ModelBuilder } from "@/components/model/model-builder"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The model's Weighting page (the Weight phase): the 1-5 allocation, the live
// budget meter, and the AI weighting review. The criteria and their 0-5
// evaluation scale live on /model.
export default function ModelWeightingPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.tabs")
  const tHelp = useTranslations("dashboard.help")
  const tBuilder = useTranslations("dashboard.model.builder")
  usePageTitle(t("weighting"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("weighting")}
        titleAdornment={
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
        }
        description={tBuilder("weightDescription")}
      />
      <ModelBuilder orgId={orgId} phase="weight" withAiReview />
    </div>
  )
}
