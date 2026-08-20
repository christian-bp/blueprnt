"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { toast } from "@/lib/toast"
import {
  makeWorkingConditionsSchema,
  type WorkingConditionsValues,
} from "@/lib/working-conditions-schema"

const KNOWN_ERROR_KEYS = ["invalidTransition"] as const

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

// The decision itself, mounted only once its current value is known: the form
// takes it as defaultValues, so it cannot be created before the read resolves.
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
  const { isDirty, isSubmitting, isValid } = form.formState

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
        <SubmitButton
          type="submit"
          isSubmitting={isSubmitting}
          disabled={!isValid || !isDirty}
          size="sm"
        >
          {t("workingConditions.saveCta")}
        </SubmitButton>
      </form>
    </Form>
  )
}

// The working-conditions materiality decision (ADR-0022 section 6.1): either a
// workingConditions criterion is active, or the dimension was tested and found
// not material, with a required motivation either way.
//
// It belongs to the Metod chapter, under the criterion documentation it sits
// beside: it is method documentation, and the section's spine counts it as
// Metod's own work (one step per criterion, plus this one). While it lived on
// Godkännande, Metod could never complete from its own page, which read as a
// spine bug rather than as a decision made elsewhere. What stays on
// Godkännande is the "working conditions tested" CHECK ROW, which reports this
// decision rather than making it.
//
// Reads through getMethodChecks rather than getMethodModel because that is the
// query carrying the decision; the section shell already subscribes to it with
// the same args, so this costs no extra subscription.
export function WorkingConditionsSection({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  // Saving the decision is an adminMutation, so an editor is not offered the
  // form at all: the same split the approval card draws, unchanged by the move.
  const { role } = useOrganization()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  if (role !== "admin") return null
  if (data === null) return null // no model yet; keep layout stable

  return (
    <section className="space-y-3 border-t pt-4">
      <div>
        <p className="flex items-center gap-1.5 font-medium text-sm">
          {t("workingConditions.heading")}
          <HelpMorphButton label={tHelp("workingConditionsDecisionLabel")}>
            {tHelp("workingConditionsDecisionBody")}
          </HelpMorphButton>
        </p>
        <p className="text-muted-foreground text-sm">
          {t("workingConditions.description")}
        </p>
      </div>
      {data === undefined ? (
        // Content-shaped: the heading, its help and the description above are
        // static i18n text and render for real; what is unknown is the current
        // decision, which is the form's own state, so the controls stand in as
        // bars sized to the boxes they replace (the toggle row, the textarea
        // and the save).
        <div aria-hidden="true" className="space-y-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-32" />
        </div>
      ) : (
        <WorkingConditionsForm orgId={orgId} current={data.workingConditions} />
      )}
    </section>
  )
}
