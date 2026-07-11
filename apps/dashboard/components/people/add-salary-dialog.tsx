"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { CURRENCY_KEYS, PAY_COMPONENT_KINDS } from "@workspace/constants"
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
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { numberInputField } from "@/lib/number-field"
import type { ValidationT } from "@/lib/validation"

// Zod factory (messages via i18n). Number fields are validated as numbers; the
// inputs bind via numberInputField, so a value reaches the schema as a number
// (or undefined when the field is cleared, which reads as the required error).
// Currency is one of the org-selectable currencies (CURRENCY_KEYS,
// the same set the organization picker offers). Components are an array
// of { kind, monthlyAmount } rows matching the payRecords component shape.
function makeSalarySchema(t: ValidationT) {
  return z.object({
    payYear: z
      .number({ error: t("required") })
      .int()
      .min(2000)
      .max(2100),
    basicMonthly: z.number({ error: t("required") }).nonnegative(),
    currency: z.enum(CURRENCY_KEYS, { error: t("required") }),
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
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const setSalary = useMutation(api.people.pay.setSalary)

  const [open, setOpen] = useState(false)

  const schema = useMemo(() => makeSalarySchema(tValidation), [tValidation])
  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      payYear: new Date().getFullYear(),
      basicMonthly: 0,
      currency: "SEK",
      components: [],
    },
  })
  const components = useFieldArray({
    control: form.control,
    name: "components",
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) form.reset()
  }

  async function onSubmit(values: SalaryFormValues) {
    try {
      await setSalary({
        orgId,
        personId,
        payYear: values.payYear,
        basicMonthly: values.basicMonthly,
        currency: values.currency,
        components: values.components,
      })
      toast.success(tToast("salarySaved"))
      form.reset({
        payYear: values.payYear,
        basicMonthly: 0,
        currency: values.currency,
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
            <DialogTitle>{t("addTitle")}</DialogTitle>
            <DialogDescription>{t("addDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("payYear")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="basicMonthly"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("basicMonthly")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          aria-label={t("basicMonthly")}
                          {...numberInputField(field)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("currency")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger
                            ref={field.ref}
                            onBlur={field.onBlur}
                            aria-label={t("currency")}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCY_KEYS.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                          <Input
                            type="number"
                            aria-label={t("componentAmount")}
                            {...numberInputField(field)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Removing an unsaved row needs no confirm: a quiet ghost
                      trashcan (RemoveConfirm's iconography without its armed
                      step) sized to the h-9 field row. */}
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
                    !form.formState.isValid || form.formState.isSubmitting
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
