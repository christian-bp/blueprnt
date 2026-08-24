"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"

// Reopening an assessment for re-evaluation: one press, audited, with a toast
// (decision 14).
//
// It used to sit behind a confirm dialog, on the reasoning that reopening a
// revealed result is a significant state change. It is significant, and it is
// also entirely reversible: the ratings are all still there, and completing
// again is one press from the flow's last step. The trail is the record, which
// was the author's own answer to whether the audit log is enough. What a
// confirm buys is protection against an ACCIDENTAL press, and this one is
// behind a row menu or beside a result, not under the reader's thumb.
//
// Shaped like the weighting chapter's save rather than like a delete: a plain
// act, a mutation, a toast. Shared by the two surfaces that offer it so the
// act cannot read as two different things depending on where it is pressed.
export function useReopenAssessment(orgId: string, roleId: Id<"roles">) {
  const tToast = useTranslations("dashboard.toast")
  const reopenAssessment = useMutation(
    api.assessment.completion.reopenAssessment
  )
  const [pending, setPending] = useState(false)

  async function reopen() {
    if (pending) return
    setPending(true)
    try {
      await reopenAssessment({ orgId, roleId })
      toast.success(tToast("assessmentReopened"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setPending(false)
    }
  }

  return { reopen, pending }
}
