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
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

const KNOWN_ERROR_KEYS = ["methodBlocked", "invalidTransition"] as const

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

function CheckRow({
  ok,
  level,
  label,
  levelLabel,
}: {
  ok: boolean
  level: "blocker" | "warning"
  label: string
  levelLabel: string
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
      : "text-amber-700 dark:text-amber-400"
  return (
    <li className="flex items-center gap-2 text-sm">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className={cn("shrink-0", tone)}
        aria-hidden="true"
      />
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">({levelLabel})</span>
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

  async function onApprove() {
    try {
      await approve({ orgId })
      toast.success(tToast("modelApproved"))
    } catch (error) {
      toast.error(errorMessage(error, tErrors, tToast("error")))
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
              />
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
