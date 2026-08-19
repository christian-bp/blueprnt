"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { BuildFraming } from "@/components/model/build-framing"
import { ModelBuilder } from "@/components/model/model-builder"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The model's build page: the company's own model assembled in one place,
// criteria and their weights together (ADR-0021 addendum, decision 8: there is
// no free-text criterion editor, only a library to choose from). Weighting no
// longer has a page of its own; what stays apart is the role-facing 1-5
// evaluation scale, which belongs to rating a role and renders there.
export default function ModelBuildPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.build")
  const tTabs = useTranslations("dashboard.model.tabs")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(tTabs("build"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={tTabs("build")}
        titleAdornment={
          <HelpMorphButton label={tHelp("criterionLabel")}>
            {tHelp("criterionBody")}
          </HelpMorphButton>
        }
        description={t("description")}
      />
      <BuildFraming />
      <ModelBuilder orgId={orgId} />
    </div>
  )
}
