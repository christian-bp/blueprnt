"use client"

import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { METHOD_CHECK_KEYS } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { CheckRemedy } from "@/components/model/check-remedy"
import { RestoreApprovedDialog } from "@/components/model/restore-approved-dialog"
import { useOrganization } from "@/components/org-context"
import { WARNING_TEXT_CLASS } from "@/lib/alert-tone"
import { methodErrorMessage } from "@/lib/method-error"
import { toast } from "@/lib/toast"

function CheckRow({
  ok,
  level,
  label,
  levelLabel,
  remedy,
}: {
  ok: boolean
  level: "blocker" | "warning"
  label: string
  levelLabel: string
  // The "how to fix it" line, rendered under the row when the check fails.
  remedy?: ReactNode
}) {
  const icon = ok
    ? CheckmarkCircle02Icon
    : level === "blocker"
      ? Cancel01Icon
      : Alert02Icon
  const tone = ok
    ? "text-success"
    : level === "blocker"
      ? "text-destructive"
      : WARNING_TEXT_CLASS
  return (
    // The row's own line stays a flex row; the remedy sits UNDER it in flow, so
    // a long instruction wraps under the finding instead of squeezing it.
    <li className="text-sm">
      <span className="flex items-center gap-2">
        <HugeiconsIcon
          icon={icon}
          strokeWidth={2}
          className={cn("shrink-0", tone)}
          aria-hidden="true"
        />
        <span>{label}</span>
        <span className="text-muted-foreground text-xs">({levelLabel})</span>
      </span>
      {remedy}
    </li>
  )
}

export function ApprovalCard({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  // The checks READ for every member (the chapter's spine needs them), but
  // every write behind this card is an adminMutation. An editor therefore sees
  // where the model stands and is offered none of the controls that change it,
  // the same split the roles surface draws with isAdmin.
  const { role } = useOrganization()
  const isAdmin = role === "admin"
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, {
    orgId,
  })
  const approve = useMutation(api.evaluationModel.approval.approveModel)
  const [restoreOpen, setRestoreOpen] = useState(false)

  if (data === undefined) {
    // Content-shaped loading state: the card's own chrome (title/description)
    // is static i18n text and renders immediately; only the checklist rows
    // and the approval state are unknown until the query resolves.
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {t("approvalHeading")}
            <HelpMorphButton label={tHelp("modelApprovalLabel")}>
              {tHelp("modelApprovalBody")}
            </HelpMorphButton>
          </CardTitle>
          <CardDescription>{t("approvalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <ul className="space-y-2">
            {METHOD_CHECK_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }
  if (data === null) return null // no model yet; keep layout stable

  const checksByKey = new Map(data.checks.map((check) => [check.key, check]))
  const hasFailingBlocker = data.checks.some(
    (check) => check.level === "blocker" && !check.ok
  )

  // The restore is offered only where it is meaningful: approval re-opened by
  // a method-affecting edit AND a stored last-approved buffer to go back to.
  // An approved model already IS its last-approved state, and a model approved
  // before the buffer existed has nothing to restore. Admin-only, like approve.
  const canRestore =
    isAdmin && data.approval === null && data.lastApprovedAt !== null

  async function onApprove() {
    try {
      await approve({ orgId })
      toast.success(tToast("modelApproved"))
    } catch (error) {
      toast.error(methodErrorMessage(error, tErrors, tToast("error")))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("approvalHeading")}
          <HelpMorphButton label={tHelp("modelApprovalLabel")}>
            {tHelp("modelApprovalBody")}
          </HelpMorphButton>
        </CardTitle>
        <CardDescription>{t("approvalDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {data.approval
                ? t("decidedBy", {
                    name: data.approval.approvedByName ?? "",
                    date: format.dateTime(new Date(data.approval.approvedAt), {
                      dateStyle: "medium",
                    }),
                  })
                : t("draftState")}
            </p>
            <div className="flex items-center gap-2">
              {canRestore && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRestoreOpen(true)}
                >
                  {t("restoreCta")}
                </Button>
              )}
              {data.approval === null && isAdmin && (
                <Button
                  type="button"
                  disabled={hasFailingBlocker}
                  onClick={onApprove}
                >
                  {t("approveModelCta")}
                </Button>
              )}
            </div>
          </div>
          {/* Which approved state the restore goes back to, on its own line so
              naming the date never crowds the two buttons. */}
          {canRestore && data.lastApprovedAt !== null && (
            <p className="text-muted-foreground text-sm">
              {t("restoreHint", {
                date: format.dateTime(new Date(data.lastApprovedAt), {
                  dateStyle: "medium",
                }),
              })}
            </p>
          )}
        </div>
        {canRestore && (
          <RestoreApprovedDialog
            orgId={orgId}
            open={restoreOpen}
            onOpenChange={setRestoreOpen}
          />
        )}
        <ul className="space-y-2">
          {METHOD_CHECK_KEYS.map((key) => {
            const check = checksByKey.get(key)
            if (check === undefined) return null
            return (
              <CheckRow
                key={key}
                ok={check.ok}
                level={check.level}
                label={t(`checks.${key}`)}
                levelLabel={t(`checkLevel.${check.level}`)}
                remedy={
                  <CheckRemedy
                    check={check}
                    dimensionShares={data.dimensionShares}
                  />
                }
              />
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
