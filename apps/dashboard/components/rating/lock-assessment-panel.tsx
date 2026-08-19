"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { SubmitButton } from "@/components/submit-button"

// The "ready to lock" state: every criterion has a rating, but the result is
// still a draft (lock-as-reveal, spec 2.4/6). Locking is the reveal itself,
// so this panel is the ONLY thing shown here -- no score, no level, nothing
// the lock has not yet unlocked. Reused by the rate flow's completion state
// and the role page's evaluation card, so the action reads identically
// wherever a role becomes ready to lock.
export function LockAssessmentPanel({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: Id<"roles">
}) {
  const t = useTranslations("dashboard.rating")
  const tToast = useTranslations("dashboard.toast")
  const lockAssessment = useMutation(api.assessment.locking.lockAssessment)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleLock() {
    setPending(true)
    setFailed(false)
    try {
      await lockAssessment({ orgId, roleId })
      toast.success(tToast("assessmentLocked"))
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t("readyToLockExplanation")}
      </p>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("lockError")}
        </p>
      )}
      <SubmitButton
        type="button"
        isSubmitting={pending}
        onClick={() => void handleLock()}
      >
        {t("lockCta")}
      </SubmitButton>
    </div>
  )
}
