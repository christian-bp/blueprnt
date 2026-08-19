"use client"

import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ApprovalCard } from "@/components/model/approval-card"
import { MethodPanel } from "@/components/model/method-panel"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

// The Method page (/model/method): documents each criterion's rationale and
// bias review, hosts the method appendix export, and (Task 6) the model
// approval lifecycle: the twelve-check checklist, the approval state and
// action, and the working-conditions materiality decision.
export default function ModelMethodPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.method")
  const tTabs = useTranslations("dashboard.model.tabs")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(tTabs("method"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={tTabs("method")}
        titleAdornment={
          <HelpMorphButton label={tHelp("methodAppendixLabel")}>
            {tHelp("methodAppendixBody")}
          </HelpMorphButton>
        }
        description={t("description")}
      />
      <ApprovalCard orgId={orgId} />
      <MethodPanel orgId={orgId} />
    </div>
  )
}
