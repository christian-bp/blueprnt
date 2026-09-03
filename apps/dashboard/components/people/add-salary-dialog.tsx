"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  BASE_PAY_BASES,
  normalizedMonthlyBase,
  PAY_COMPONENT_KINDS,
} from "@workspace/constants"
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
import { useMutation, useQuery } from "convex/react"
import { CurrencyInput, currencyInputField } from "@/components/currency-input"
import { HelpMorphButton } from "@/components/help-morph-button"
import { NumberInput } from "@/components/number-input"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "@/lib/toast"
import { z } from "zod"
import { useMoney } from "@/hooks/use-money"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { numberInputField } from "@/lib/number-field"
import type { ValidationT } from "@/lib/validation"

// Zod factory (messages via i18n). Number fields are validated as numbers; the
// inputs bind via numberInputField / CurrencyInput, so a value reaches the
// schema as a number (or undefined when the field is cleared, which reads as
// the required error). Currency is NOT a form field: all of an org's money is
// in the organization's own currency (enforced by the backend), so the form
// only displays it. basicAmount is the figure AS ENTERED (a monthly salary or
// an hourly rate, per basis); the backend derives the normalized monthly
// figure. Components are an array of { kind, monthlyAmount } rows matching
// the payRecords component shape.
function makeSalarySchema(t: ValidationT) {
  return z.object({
    payYear: z
      .number({ error: t("required") })
      .int()
      .min(2000)
      .max(2100),
    basis: z.enum(BASE_PAY_BASES),
    basicAmount: z.number({ error: t("required") }).nonnegative(),
    components: z.array(
      z.object({
        kind: z.string().min(1, t("required")),
        monthlyAmount: z.number().nonnegative(),
      })
    ),
  })
}

export type SalaryFormValues = z.infer<ReturnType<typeof makeSalarySchema>>

// The manual salary entry as a dialog: the salary card's header carries the
// trigger, the dialog holds the form (no panel chrome of its own; the dialog
// is the panel) with cancel + submit in the footer, per the dialog anatomy
// convention. Closing resets the form.
export function AddSalaryDialog({ personId }: { personId: Id<"people"> }) {
  const t = useTranslations("dashboard.people.salaryForm")
  const tHelp = useTranslations("dashboard.help")
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const setSalary = useMutation(api.people.pay.setSalary)
  const money = useMoney()
  // The org's currency and the person's resolved full-time hours (own value,
  // else the org default, else the country default): the currency shows in
  // the amount fields and is sent on save (the backend rejects any other
  // currency, so we must send the real one, never a guess); the hours derive
  // the monthly line shown under an hourly rate. Both are undefined until the
  // query resolves; saving is blocked until then.
  const defaults = useQuery(api.people.pay.getPayDefaults, { orgId, personId })
  const currency = defaults?.currency
  const hours = defaults?.hoursPerMonth

  const [open, setOpen] = useState(false)

  const schema = useMemo(() => makeSalarySchema(tValidation), [tValidation])
  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      payYear: new Date().getFullYear(),
      basis: "monthly",
      basicAmount: 0,
      components: [],
    },
  })
  const components = useFieldArray({
    control: form.control,
    name: "components",
  })
  const basis = form.watch("basis")
  const amount = form.watch("basicAmount")

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) form.reset()
  }

  async function onSubmit(values: SalaryFormValues) {
    // The submit button is disabled until the defaults resolve, so currency
    // is defined here; this guard also narrows the type for the mutation call.
    if (currency === undefined) return
    try {
      await setSalary({
        orgId,
        personId,
        payYear: values.payYear,
        basis: values.basis,
        basicAmount: values.basicAmount,
        // Always the org's own currency; the form never lets the user pick one,
        // and the backend rejects any other value.
        currency,
        components: values.components,
      })
      toast.success(tToast("salarySaved"))
      form.reset({
        payYear: values.payYear,
        // The chosen basis carries over: an hourly earner's next entry is
        // almost always hourly too.
        basis: values.basis,
        basicAmount: 0,
        components: [],
      })
      setOpen(false)
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t("addTitle")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-1.5">
              <DialogTitle>{t("addTitle")}</DialogTitle>
              <HelpMorphButton label={tHelp("payBasisLabel")}>
                {tHelp("payBasisBody")}
              </HelpMorphButton>
            </div>
            <DialogDescription>{t("addDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* The basis choice comes first: it decides what the amount
                  field below means (a monthly salary or an hourly rate) and
                  whether the derived monthly line appears. */}
              <FormField
                control={form.control}
                name="basis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basis.label")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={Object.fromEntries(
                        BASE_PAY_BASES.map((value) => [
                          value,
                          t(`basis.${value}`),
                        ])
                      )}
                    >
                      <FormControl>
                        <SelectTrigger
                          aria-label={t("basis.label")}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BASE_PAY_BASES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`basis.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("payYear")}</FormLabel>
                      <FormControl>
                        <NumberInput
                          aria-label={t("payYear")}
                          {...numberInputField(field)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="basicAmount"
                  render={({ field }) => {
                    const amountLabel =
                      basis === "hourly" ? t("hourlyAmount") : t("basicMonthly")
                    return (
                      <FormItem>
                        <FormLabel>{amountLabel}</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            aria-label={amountLabel}
                            currency={currency ?? ""}
                            {...currencyInputField(field)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
              {/* Reserved-height slot (min-h-5), full width below the
                  two-column grid rather than confined to the amount field's
                  half-width column: the real derived text (e.g. Swedish or
                  Finnish, with a long amount and the "other" country's
                  173.33 h default) wraps to two lines at the ~168px half
                  column, which reflows the footer below on every basis
                  toggle. At full width it fits every locale on one line, so
                  the slot's height never changes. */}
              <p className="min-h-5 text-muted-foreground text-sm">
                {basis === "hourly" && hours !== undefined && amount > 0
                  ? t("derivedMonthly", {
                      amount: money(
                        normalizedMonthlyBase(amount, "hourly", hours),
                        currency ?? ""
                      ),
                      hours,
                    })
                  : null}
              </p>

              {/* Component rows (variable/bonus/etc). Each row is a kind Select
                  plus a monthly amount. Added/removed with the field array so
                  the layout extends below existing content, never reflows it. */}
              {components.fields.map((row, index) => (
                <div key={row.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`components.${index}.kind`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormLabel>{t("componentKind")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={Object.fromEntries(
                            PAY_COMPONENT_KINDS.map((kind) => [
                              kind,
                              t(`componentKinds.${kind}`),
                            ])
                          )}
                        >
                          <FormControl>
                            {/* w-full: the vendor trigger is w-fit by default
                                and would overflow its column on long kind
                                names (e.g. Swedish). */}
                            <SelectTrigger
                              aria-label={t("componentKind")}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAY_COMPONENT_KINDS.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {t(`componentKinds.${kind}`)}
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
                    name={`components.${index}.monthlyAmount`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormLabel>{t("componentAmount")}</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            aria-label={t("componentAmount")}
                            currency={currency ?? ""}
                            {...currencyInputField(field)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Removing an unsaved row needs no confirm: a quiet ghost
                      trashcan (RemoveConfirm's iconography without its armed
                      step) sized to the h-8 field row. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeComponent")}
                    className="shrink-0 text-muted-foreground"
                    onClick={() => components.remove(index)}
                  >
                    <HugeiconsIcon
                      icon={Delete02Icon}
                      size={16}
                      strokeWidth={2}
                    />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  components.append({
                    kind: PAY_COMPONENT_KINDS[0],
                    monthlyAmount: 0,
                  })
                }
              >
                {t("addComponent")}
              </Button>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  {t("cancel")}
                </Button>
                <SubmitButton
                  type="submit"
                  isSubmitting={form.formState.isSubmitting}
                  disabled={
                    !form.formState.isValid ||
                    form.formState.isSubmitting ||
                    // The org currency must be known before saving (see above).
                    currency === undefined
                  }
                >
                  {t("submit")}
                </SubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
