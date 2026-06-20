"use client"

import { MIN_CRITERIA } from "@workspace/core"
import { useTranslations } from "next-intl"
import { ModelEditor } from "@/components/model/model-editor"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// The evaluation model page: the shared criteria editor plus the AI weight
// review. The finished model never drops below the composition floor, so
// removal hides at MIN_CRITERIA here (unlike during onboarding, where a model
// under construction removes freely). Band thresholds and deeper E2 editing
// come later.
export default function ModelPage() {
  const { orgId } = useOrganization()
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("model"))
  return <ModelEditor orgId={orgId} withAiReview removalFloor={MIN_CRITERIA} />
}
