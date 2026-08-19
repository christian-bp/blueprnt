"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { MethodCheckKey } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import { toast } from "@/lib/toast"
import {
  makeWorkingConditionsSchema,
  type WorkingConditionsValues,
} from "@/lib/working-conditions-schema"

// The twelve checks in the fixed order validateMethod returns them
// (packages/core method-checks.ts), so the card's row order never depends on
// however the wire array happens to arrive.
const CHECK_ORDER: MethodCheckKey[] = [
  "dimensionCoverage",
  "workingConditionsTested",
  "criterionCount",
  "dimensionCaps",
  "anchorsComplete",
  "documentationComplete",
  "weightBudget",
  "levelRulesValid",
  "zoneProfileMonotonic",
  "dimensionWeightBalance",
  "peopleLeadershipWeight",
  "overlapPairs",
]

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

function WorkingConditionsForm({
  orgId,
  current,
}: {
  orgId: string
  current: {
    status: "active" | "testedNotMaterial"
    motivation: string
  } | null
}) {
  const t = useTranslations("dashboard.model.method")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const save = useMutation(
    api.evaluationModel.approval.setWorkingConditionsDecision
  )

  const schema = useMemo(() => makeWorkingConditionsSchema(tv), [tv])
  const form = useForm<WorkingConditionsValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      status: current?.status ?? "active",
      motivation: current?.motivation ?? "",
    },
  })
  const { isDirty, isSubmitting } = form.formState

  async function onValid(values: WorkingConditionsValues) {
    try {
      await save({ orgId, ...values })
      toast.success(tToast("workingConditionsDecided"))
      form.reset(values)
    } catch (error) {
      toast.error(errorMessage(error, tErrors, tToast("error")))
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="font-medium text-sm">{t("workingConditions.heading")}</p>
        <p className="text-muted-foreground text-sm">
          {t("workingConditions.description")}
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-3" onSubmit={form.handleSubmit(onValid)}>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("workingConditions.statusLabel")}</FormLabel>
                <FormControl>
                  <ToggleGroup
                    variant="outline"
                    value={field.value ? [field.value] : []}
                    onValueChange={(groupValue) => {
                      const next = groupValue[0]
                      if (next !== undefined) field.onChange(next)
                    }}
                  >
                    <ToggleGroupItem
                      value="active"
                      className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                    >
                      {t("workingConditions.activeOption")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="testedNotMaterial"
                      className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                    >
                      {t("workingConditions.testedNotMaterialOption")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                {field.value === "testedNotMaterial" && (
                  <p className="text-muted-foreground text-xs">
                    {t("workingConditions.activeBlockedHint")}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motivation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("workingConditions.motivationLabel")}</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isDirty && (
            <SubmitButton type="submit" isSubmitting={isSubmitting} size="sm">
              {t("workingConditions.saveCta")}
            </SubmitButton>
          )}
        </form>
      </Form>
    </div>
  )
}

export function ApprovalCard({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
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
          <CardTitle>{t("approvalHeading")}</CardTitle>
          <CardDescription>{t("approvalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <ul className="space-y-2">
            {CHECK_ORDER.map((key) => (
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
        <CardTitle>{t("approvalHeading")}</CardTitle>
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
          {data.approval === null && (
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
          {CHECK_ORDER.map((key) => {
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
        <WorkingConditionsForm orgId={orgId} current={data.workingConditions} />
      </CardContent>
    </Card>
  )
}
