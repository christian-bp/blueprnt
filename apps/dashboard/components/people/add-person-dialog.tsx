"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
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
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DatePicker } from "@/components/date-picker"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import type { ValidationT } from "@/lib/validation"

// The pay-transparency gender categories, mirroring the people table's union.
const GENDER_VALUES = ["Man", "Kvinna"] as const

// Zod factory (messages via i18n). Only name and gender are required (the
// backend re-validates); the optional strings normalize to "" here and are
// omitted from the mutation payload. FTE reaches the schema as a number via
// valueAsNumber, with the empty input mapped to undefined at the field.
function makeAddPersonSchema(t: ValidationT) {
  return z.object({
    displayName: z.string().trim().min(1, t("required")),
    gender: z.enum(GENDER_VALUES, { error: t("required") }),
    title: z.string().trim(),
    department: z.string().trim(),
    externalRef: z.string().trim(),
    employmentStartDate: z.string(),
    ftePercent: z.number().min(1).max(100).optional(),
  })
}

export type AddPersonValues = z.infer<ReturnType<typeof makeAddPersonSchema>>

// Distinguishes the taken-employee-number rejection from transient failures,
// so the error lands inline on the field that caused it (same pattern as
// isDuplicateRoleError). ConvexError codes are serialized into the message.
function isPersonRefExistsError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("errors.personRefExists")
  )
}

// Manual person creation beside the payroll import: the register header
// carries the trigger, the dialog holds the form (the dialog is the panel;
// no chrome of its own) with cancel + submit in the footer. On success it
// navigates to the new person's page (createRole -> role page precedent),
// where salary and classification can follow.
export function AddPersonDialog() {
  const t = useTranslations("dashboard.people.addPerson")
  const tGender = useTranslations("dashboard.people.gender")
  const tValidation = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const router = useRouter()
  const createPerson = useMutation(api.people.people.createPerson)

  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState(false)

  const schema = useMemo(() => makeAddPersonSchema(tValidation), [tValidation])
  const form = useForm<AddPersonValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      displayName: "",
      // Unpicked gender (empty string) fails via z.enum, gating isValid
      // until an explicit choice is made.
      gender: "" as AddPersonValues["gender"],
      title: "",
      department: "",
      externalRef: "",
      employmentStartDate: "",
      ftePercent: undefined,
    },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setFailure(false)
    }
  }

  async function onSubmit(values: AddPersonValues) {
    setFailure(false)
    try {
      const { publicId } = await createPerson({
        orgId,
        displayName: values.displayName,
        gender: values.gender,
        ...(values.externalRef !== ""
          ? { externalRef: values.externalRef }
          : {}),
        ...(values.title !== "" ? { title: values.title } : {}),
        ...(values.department !== "" ? { department: values.department } : {}),
        ...(values.employmentStartDate !== ""
          ? { employmentStartDate: values.employmentStartDate }
          : {}),
        ...(values.ftePercent !== undefined
          ? { ftePercent: values.ftePercent }
          : {}),
      })
      toast.success(tToast("personCreated"))
      setOpen(false)
      router.push(`/people/${publicId}`)
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
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                    <FormLabel>{t("nameLabel")}</FormLabel>
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
                      <FormLabel>{t("genderLabel")}</FormLabel>
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
                            <SelectValue placeholder={t("genderLabel")} />
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
                      <FormLabel>{t("externalRefLabel")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("titleLabel")}</FormLabel>
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
                      <FormLabel>{t("departmentLabel")}</FormLabel>
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
                      <FormLabel>{t("startDateLabel")}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          ariaLabel={t("startDateLabel")}
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
                      <FormLabel>{t("fteLabel")}</FormLabel>
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
                  onClick={() => handleOpenChange(false)}
                >
                  {t("cancel")}
                </Button>
                <SubmitButton
                  type="submit"
                  isSubmitting={form.formState.isSubmitting}
                  disabled={!form.formState.isValid}
                >
                  {t("cta")}
                </SubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
