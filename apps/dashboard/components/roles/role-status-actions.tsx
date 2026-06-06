"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { MorphConfirmButton } from "@/components/morph-confirm-button"
import { useOrganization } from "@/components/org-context"

// Status workflow per the spec's machine: members submit and withdraw,
// admins approve and reopen. The backend enforces every rule; this component
// only hides what the current role cannot do. Forward moves stay disabled
// until the role is fully rated with a complete profile (canComplete).
export function RoleStatusActions({
  orgId,
  roleId,
  status,
  canComplete,
}: {
  orgId: string
  roleId: Id<"roles">
  status: string
  canComplete: boolean
}) {
  const t = useTranslations("dashboard.roles.status")
  const tAssessment = useTranslations("assessment")
  const { role: orgRole } = useOrganization()
  const setRoleStatus = useMutation(api.assessment.roles.setRoleStatus)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const isAdmin = orgRole === "admin"

  async function transition(to: "draft" | "inReview" | "approved") {
    setPending(true)
    setFailed(false)
    try {
      await setRoleStatus({ orgId, roleId, to })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tAssessment("assessment")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "draft" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !canComplete}
              onClick={() => transition("inReview")}
            >
              {t("submitCta")}
            </Button>
            {isAdmin && (
              <Button
                type="button"
                disabled={pending || !canComplete}
                onClick={() => transition("approved")}
              >
                {t("approveCta")}
              </Button>
            )}
          </div>
        )}
        {status === "inReview" && (
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button
                type="button"
                disabled={pending || !canComplete}
                onClick={() => transition("approved")}
              >
                {t("approveCta")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => transition("draft")}
            >
              {t("withdrawCta")}
            </Button>
          </div>
        )}
        {status === "approved" && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{t("lockedHint")}</p>
            {isAdmin && (
              <MorphConfirmButton
                variant="label"
                triggerText={t("reopenCta")}
                confirmLabel={t("reopenConfirm")}
                cancelLabel={t("cancel")}
                align="left"
                disabled={pending}
                onConfirm={() => transition("draft")}
              />
            )}
          </div>
        )}
        {status === "draft" && !canComplete && (
          <p className="text-muted-foreground text-sm">{t("incompleteHint")}</p>
        )}
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
