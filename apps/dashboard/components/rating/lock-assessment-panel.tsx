"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { SubmitButton } from "@/components/submit-button"

// The lock gate's coded failures a user can realistically hit while sitting
// on this panel (another admin's edit landed between page load and the
// click): the model losing its approval, a new criterion making the role
// incomplete again, a rating that no longer carries a required motivation, or
// the assessment already having been locked from another tab. Mirrors
// approval-card.tsx's errorMessage helper.
const KNOWN_ERROR_KEYS = [
  "ratingsIncomplete",
  "motivationRequired",
  "modelNotApproved",
  "assessmentLocked",
] as const

function errorMessage(
  error: unknown,
  tErrors: (key: (typeof KNOWN_ERROR_KEYS)[number]) => string,
  fallback: string
): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return tErrors(known)
  }
  return fallback
}

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
  const tErrors = useTranslations("errors")
  const lockAssessment = useMutation(api.assessment.locking.lockAssessment)
  const [pending, setPending] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  async function handleLock() {
    setPending(true)
    setErrorText(null)
    try {
      await lockAssessment({ orgId, roleId })
      toast.success(tToast("assessmentLocked"))
    } catch (error) {
      setErrorText(errorMessage(error, tErrors, t("lockError")))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t("readyToLockExplanation")}
      </p>
      {errorText !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorText}
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
