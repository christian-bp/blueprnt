"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import { useReopenAssessment } from "@/hooks/use-reopen-assessment"

// The reopen act beside a revealed result: one press, no confirm (decision
// 14). What it costs the reader is stated by the sentence above the result,
// not by a dialog interrupting them to say it.
export function ReopenAssessmentButton({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: Id<"roles">
}) {
  const t = useTranslations("dashboard.rating")
  const { reopen, pending } = useReopenAssessment(orgId, roleId)
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => void reopen()}
    >
      {t("reopenCta")}
    </Button>
  )
}
