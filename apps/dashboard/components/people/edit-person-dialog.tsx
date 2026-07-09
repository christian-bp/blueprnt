"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
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
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DatePicker } from "@/components/date-picker"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import type { ValidationT } from "@/lib/validation"

// The pay-transparency gender categories, mirroring the people table's union.
const GENDER_VALUES = ["Man", "Kvinna"] as const

// The editable identity fields, as the dialog receives them from the person
// page (role + level live in EditClassificationDialog; salary on its card).
export interface EditablePerson {
  personId: Id<"people">
  displayName: string
  gender: "Man" | "Kvinna"
  externalRef: string | null
  department: string | null
  employmentStartDate: string | null
  ftePercent: number | null
}

// Zod factory (messages via i18n): name and gender stay required; the rest
// may be empty, and an emptied field CLEARS the stored value on save.
function makeEditPersonSchema(t: ValidationT) {
  return z.object({
    displayName: z.string().trim().min(1, t("required")),
    gender: z.enum(GENDER_VALUES, { error: t("required") }),
    externalRef: z.string().trim(),
    department: z.string().trim(),
    employmentStartDate: z.string(),
    ftePercent: z.number().min(1).max(100).optional(),
  })
}

type EditPersonValues = z.infer<ReturnType<typeof makeEditPersonSchema>>

function isPersonRefExistsError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("errors.personRefExists")
  )
}

// Maps a person to the form's value shape (stored-absent becomes "").
function toFormValues(person: EditablePerson): EditPersonValues {
  return {
    displayName: person.displayName,
    gender: person.gender,
    externalRef: person.externalRef ?? "",
    department: person.department ?? "",
    employmentStartDate: person.employmentStartDate ?? "",
    ftePercent: person.ftePercent ?? undefined,
  }
}

// Full-field editing of an employee's identity details from the person page
// (the actions menu carries the trigger). Pre-filled and therefore gated on
// isDirty as well as isValid, so an unchanged form cannot fire a no-op
// mutation. The backend clears a field when it receives "" (or null for
// FTE): an explicit manual decision, unlike the import path where an absent
// field never clears.
export function EditPersonDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: EditablePerson
}) {
  const t = useTranslations("dashboard.people.editPerson")
  const tForm = useTranslations("dashboard.people.personForm")
  const tGender = useTranslations("dashboard.people.gender")
  const tValidation = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const updatePerson = useMutation(api.people.people.updatePerson)

  const [failure, setFailure] = useState(false)

  const schema = useMemo(() => makeEditPersonSchema(tValidation), [tValidation])
  const form = useForm<EditPersonValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: toFormValues(person),
  })

  // Re-prime the form from the live person each time the dialog opens (the
  // reactive query may have changed it since the last open, and a cancelled
  // edit must not leak into the next one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on open
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(person))
      setFailure(false)
    }
  }, [open])

  // Destructured at the top so the formState proxy registers the
  // subscriptions on the first render; inline reads inside the (initially
  // unmounted) dialog content register too late and the gate never updates.
  const { isValid, isDirty, isSubmitting } = form.formState

  async function onSubmit(values: EditPersonValues) {
    setFailure(false)
    try {
      await updatePerson({
        orgId,
        personId: person.personId,
        displayName: values.displayName,
        gender: values.gender,
        externalRef: values.externalRef,
        department: values.department,
        employmentStartDate: values.employmentStartDate,
        ftePercent: values.ftePercent ?? null,
      })
      toast.success(tToast("personUpdated"))
      onOpenChange(false)
    } catch (error) {
      if (isPersonRefExistsError(error)) {
        form.setError("externalRef", {
          message: tErrors("personRefExists"),
        })
      } else {
        setFailure(true)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tForm("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("genderLabel")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={Object.fromEntries(
                        GENDER_VALUES.map((value) => [value, tGender(value)])
                      )}
                    >
                      <FormControl>
                        <SelectTrigger
                          ref={field.ref}
                          onBlur={field.onBlur}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {tGender(value)}
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
                name="externalRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("externalRefLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("departmentLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employmentStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("startDateLabel")}</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        ariaLabel={tForm("startDateLabel")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ftePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fteLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        onChange={(e) =>
                          field.onChange(
                            Number.isNaN(e.target.valueAsNumber)
                              ? undefined
                              : e.target.valueAsNumber
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {failure && (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tForm("cancel")}
              </Button>
              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={!isValid || !isDirty}
              >
                {t("cta")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
