"use client"

import { useTranslations } from "next-intl"
import { NavCountBadge } from "@/components/nav-count-badge"
import { useOrganization } from "@/components/org-context"
import type { InnerNavCountId } from "@/lib/navigation"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { useEvaluationSummary } from "@/hooks/use-evaluation-summary"

// The inner-nav rows' live todo counter: the registry names a counter by id
// (lib/navigation.ts InnerNavCountId) and this component owns what each id
// means, so a new counter is one branch here plus its id on the entry. Each
// id renders through its own child so the hooks stay unconditional; while a
// summary loads, nothing renders (a badge springing in with the real count
// beats a placeholder flashing at zero), and NavCountBadge hides itself at
// zero because nothing left is not a notification.
export function InnerNavCount({ id }: { id: InnerNavCountId }) {
  return id === "classifyRemaining" ? (
    <ClassifyRemaining />
  ) : (
    <EvaluateRemaining />
  )
}

function ClassifyRemaining() {
  const t = useTranslations("dashboard.people.tabs")
  const { orgId } = useOrganization()
  const { loading, remaining } = useClassificationSummary(orgId)
  if (loading) return null
  return (
    <NavCountBadge
      count={remaining}
      label={t("remainingLabel", { count: remaining })}
    />
  )
}

function EvaluateRemaining() {
  const t = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const { loading, remaining } = useEvaluationSummary(orgId)
  if (loading) return null
  return (
    <NavCountBadge
      count={remaining}
      label={t("rolesRemainingLabel", { count: remaining })}
    />
  )
}
