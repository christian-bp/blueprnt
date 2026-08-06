"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { PAY_GAP_REASONS } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CurrencyInput, currencyInputField } from "@/components/currency-input"
import { DatePicker } from "@/components/date-picker"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { toast } from "@/lib/toast"
import type { ValidationT } from "@/lib/validation"
import type {
  ActionPriority,
  ActionTargetWire,
  PayMappingActionWire,
} from "./pay-mapping-gap-types"

const PRIORITIES: ActionPriority[] = ["high", "medium", "low"]

// Zod factory (messages via i18n, per the forms convention). The target is
// fixed by the caller (prefilled from the row/group the user opened this
// from), so it is never a form field. Cost is optional; an empty field
// reaches the schema as undefined.
function makeActionSchema(t: ValidationT) {
  return z.object({
    problem: z.string().trim().min(1, t("required")),
    plannedAction: z.string().trim().min(1, t("required")),
    reason: z.string().optional(),
    ownerUserId: z.string().min(1, t("required")),
    plannedDate: z.string().min(1, t("required")),
    estimatedCost: z.number().nonnegative().optional(),
    priority: z.enum(["high", "medium", "low"]),
  })
}

export type ActionFormValues = z.infer<ReturnType<typeof makeActionSchema>>

function isoToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`)
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

interface ActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: Id<"payMappingRuns">
  target: ActionTargetWire
  // Plain display text for what the action is anchored to (the group's
  // label, or a person's name inside it): the dialog states the context
  // instead of asking for it.
  targetLabel: string
  action?: PayMappingActionWire
  currency: string
}

// The åtgärd form (Iteration 2 note 5) as a dialog: opened from a group
// heading, a member row, or a tvärnivå pair, with the target prefilled and
// locked. Creates a new action, or edits an existing one when `action` is
// given. Dialog anatomy: header, body with no panel chrome of its own,
// cancel + submit right-aligned in the footer.
//
// The form body mounts only while the dialog is open and is KEYED by the
// record it edits, so each opening starts from that record's own defaults.
// Deliberately not a reset effect: useForm's returned object (and the
// memoized defaults behind it) can change identity mid-edit, and a reset
// firing on a later render wipes isDirty, permanently disabling the submit.
export function ActionDialog(props: ActionDialogProps) {
  const { open, onOpenChange, action } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <ActionDialogForm key={action?.actionId ?? "new"} {...props} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ActionDialogForm({
  onOpenChange,
  runId,
  target,
  targetLabel,
  action,
  currency,
}: ActionDialogProps) {
  const t = useTranslations("dashboard.payMapping.actions")
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const createAction = useMutation(api.payMapping.actions.createAction)
  const updateAction = useMutation(api.payMapping.actions.updateAction)
  const owners = useQuery(api.payMapping.actions.listActionOwners, { orgId })

  const schema = useMemo(() => makeActionSchema(tValidation), [tValidation])
  const defaults: ActionFormValues = useMemo(
    () => ({
      problem: action?.problem ?? "",
      plannedAction: action?.plannedAction ?? "",
      reason: action?.reason ?? undefined,
      ownerUserId: action?.ownerUserId ?? "",
      plannedDate: action === undefined ? "" : msToIso(action.plannedDate),
      estimatedCost: action?.estimatedCost ?? undefined,
      priority: action?.priority ?? "medium",
    }),
    [action]
  )
  const form = useForm<ActionFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults,
  })

  async function onSubmit(values: ActionFormValues) {
    const payload = {
      orgId,
      target,
      problem: values.problem.trim(),
      plannedAction: values.plannedAction.trim(),
      ...(values.reason === undefined
        ? {}
        : { reason: values.reason as PayMappingActionWire["reason"] & string }),
      ownerUserId: values.ownerUserId,
      plannedDate: isoToMs(values.plannedDate),
      ...(values.estimatedCost === undefined
        ? {}
        : { estimatedCost: values.estimatedCost }),
      priority: values.priority,
    }
    try {
      if (action === undefined) {
        await createAction({ ...payload, runId })
        toast.success(tToast("payMappingActionCreated"))
      } else {
        await updateAction({ ...payload, actionId: action.actionId })
        toast.success(tToast("payMappingActionUpdated"))
      }
      onOpenChange(false)
    } catch {
      toast.error(tToast("error"))
    }
  }

  const isEdit = action !== undefined

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
        <DialogDescription>
          {t("linkedTo", { target: targetLabel })}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="problem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("problem")}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="plannedAction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("plannedAction")}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reason")}</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    items={Object.fromEntries(
                      PAY_GAP_REASONS.map((reason) => [
                        reason,
                        tReasons(reason),
                      ])
                    )}
                  >
                    <FormControl>
                      <SelectTrigger
                        aria-label={t("reason")}
                        className="w-full"
                      >
                        <SelectValue placeholder={t("reasonPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAY_GAP_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {tReasons(reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ownerUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("owner")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={Object.fromEntries(
                      (owners ?? []).map((o) => [o.userId, o.name])
                    )}
                  >
                    <FormControl>
                      <SelectTrigger aria-label={t("owner")} className="w-full">
                        <SelectValue placeholder={t("ownerPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(owners ?? []).map((o) => (
                        <SelectItem key={o.userId} value={o.userId}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plannedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("plannedDate")}</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ariaLabel={t("plannedDate")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("priorityLabel")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={Object.fromEntries(
                      PRIORITIES.map((p) => [p, t(`priority.${p}`)])
                    )}
                  >
                    <FormControl>
                      <SelectTrigger
                        aria-label={t("priorityLabel")}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`priority.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("estimatedCost")}</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      aria-label={t("estimatedCost")}
                      currency={currency}
                      {...currencyInputField(field)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <SubmitButton
              type="submit"
              isSubmitting={form.formState.isSubmitting}
              // An edit opens valid, so it also gates on isDirty: an
              // unchanged form must not fire a no-op mutation (which would
              // still write an audit row).
              disabled={
                !form.formState.isValid ||
                form.formState.isSubmitting ||
                (isEdit && !form.formState.isDirty)
              }
            >
              {t("save")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
