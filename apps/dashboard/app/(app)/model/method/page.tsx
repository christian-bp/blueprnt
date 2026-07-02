"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MethodPanel } from "@/components/model/method-panel"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The Method page (/model/method): documents each criterion's rationale and
// bias review, and will host the method appendix export (Task 6).
export default function ModelMethodPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(t("title"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        titleAdornment={
          <HelpMorphButton label={tHelp("methodAppendixLabel")}>
            {tHelp("methodAppendixBody")}
          </HelpMorphButton>
        }
        description={t("description")}
      />
      <MethodPanel orgId={orgId} />
    </div>
  )
}
