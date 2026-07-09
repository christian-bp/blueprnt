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
import { isValidLevelForTrack, TRACK_LEVELS } from "@workspace/constants"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DatePicker } from "@/components/date-picker"
import { useOrganization } from "@/components/org-context"
import type { AssignableRole } from "@/components/people/edit-classification-dialog"
import { SubmitButton } from "@/components/submit-button"
import type { ValidationT } from "@/lib/validation"

// The pay-transparency gender categories, mirroring the people table's union.
const GENDER_VALUES = ["Man", "Kvinna"] as const

// Zod factory (messages via i18n). Only name and gender are required (the
// backend re-validates); the optional strings normalize to "" here and are
// omitted from the mutation payload. The role + level pair is optional as a
// pair: no role means the person starts unassigned (assignable later on the
// person page); a picked role requires a level valid for its track
// (ADR-0005). FTE reaches the schema as a number via valueAsNumber, with the
// empty input mapped to undefined at the field.
function makeAddPersonSchema(t: ValidationT, roles: AssignableRole[]) {
  return z
    .object({
      displayName: z.string().trim().min(1, t("required")),
      gender: z.enum(GENDER_VALUES, { error: t("required") }),
      roleId: z.string(),
      level: z.string(),
      department: z.string().trim(),
      externalRef: z.string().trim(),
      employmentStartDate: z.string(),
      ftePercent: z.number().min(1).max(100).optional(),
    })
    .refine(
      (values) => {
        if (values.roleId === "") return true
        const role = roles.find((r) => String(r.roleId) === values.roleId)
        return (
          role !== undefined &&
          isValidLevelForTrack(role.trackKey, values.level)
        )
      },
      { path: ["level"], message: t("required") }
    )
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
  const tForm = useTranslations("dashboard.people.personForm")
  const tDetail = useTranslations("dashboard.people.detail")
  const tClassify = useTranslations(
    "dashboard.people.detail.editClassification"
  )
  const tGender = useTranslations("dashboard.people.gender")
  const tValidation = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const router = useRouter()
  const createPerson = useMutation(api.people.people.createPerson)
  const assignPerson = useMutation(api.people.assignments.assignPersonToRole)

  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState(false)

  // The role options for the optional assignment; fetched only while the
  // dialog is open (the register page itself does not need the roles).
  const rolesQuery = useQuery(
    api.assessment.roles.listRoles,
    open ? { orgId, locale } : "skip"
  )
  const roles: AssignableRole[] = useMemo(
    () =>
      (rolesQuery ?? []).map((role) => ({
        roleId: String(role.roleId),
        title: role.title,
        trackKey: role.trackKey,
      })),
    [rolesQuery]
  )

  const schema = useMemo(
    () => makeAddPersonSchema(tValidation, roles),
    [tValidation, roles]
  )
  const form = useForm<AddPersonValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      displayName: "",
      // Unpicked gender (empty string) fails via z.enum, gating isValid
      // until an explicit choice is made.
      gender: "" as AddPersonValues["gender"],
      roleId: "",
      level: "",
      department: "",
      externalRef: "",
      employmentStartDate: "",
      ftePercent: undefined,
    },
  })

  const selectedRoleId = form.watch("roleId")
  const selectedRole = roles.find((r) => r.roleId === selectedRoleId)
  const levels = selectedRole
    ? (TRACK_LEVELS[selectedRole.trackKey as keyof typeof TRACK_LEVELS] ?? [])
    : []

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setFailure(false)
    }
  }

  async function onSubmit(values: AddPersonValues) {
    setFailure(false)
    let created: Awaited<ReturnType<typeof createPerson>>
    try {
      created = await createPerson({
        orgId,
        displayName: values.displayName,
        gender: values.gender,
        ...(values.externalRef !== ""
          ? { externalRef: values.externalRef }
          : {}),
        ...(values.department !== "" ? { department: values.department } : {}),
        ...(values.employmentStartDate !== ""
          ? { employmentStartDate: values.employmentStartDate }
          : {}),
        ...(values.ftePercent !== undefined
          ? { ftePercent: values.ftePercent }
          : {}),
      })
    } catch (error) {
      if (isPersonRefExistsError(error)) {
        form.setError("externalRef", {
          message: tErrors("personRefExists"),
        })
      } else {
        setFailure(true)
      }
      return
    }
    // The optional assignment is a second write: if it fails the person
    // still exists, so surface the error but continue to the person page,
    // where Edit role and level can finish the job.
    if (values.roleId !== "") {
      try {
        await assignPerson({
          orgId,
          personId: created.personId,
          roleId: values.roleId as Id<"roles">,
          level: values.level,
          levelSource: "confirmed",
        })
      } catch {
        toast.error(tToast("error"))
      }
    }
    toast.success(tToast("personCreated"))
    setOpen(false)
    router.push(`/people/${created.publicId}`)
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
                            <SelectValue placeholder={tForm("genderLabel")} />
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
                {/* Optional role + level pair (same controls as the person
                    page's Edit role and level): a manually added person gets
                    a real role directly instead of a free-text title (titles
                    are the payroll import's matching artifact). */}
                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDetail("role")}</FormLabel>
                      <Select
                        value={field.value}
                        items={roles.map((role) => ({
                          value: role.roleId,
                          label: role.title,
                        }))}
                        onValueChange={(value) => {
                          field.onChange(value)
                          // A role on another track invalidates the picked
                          // level: fall back to the new track's first level.
                          const role = roles.find((r) => r.roleId === value)
                          const trackLevels = role
                            ? (TRACK_LEVELS[
                                role.trackKey as keyof typeof TRACK_LEVELS
                              ] ?? [])
                            : []
                          const level = form.getValues("level")
                          if (!trackLevels.includes(level)) {
                            form.setValue("level", trackLevels[0] ?? "", {
                              shouldValidate: true,
                            })
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger
                            ref={field.ref}
                            onBlur={field.onBlur}
                            className="w-full"
                          >
                            <SelectValue
                              placeholder={tClassify("rolePlaceholder")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.roleId} value={role.roleId}>
                              {role.title}
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
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDetail("level")}</FormLabel>
                      {/* Keyed by track: a cross-track role change must
                          remount options and value together (the bubble
                          select otherwise fires a spurious ""). */}
                      <Select
                        key={selectedRole?.trackKey ?? "no-track"}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={selectedRole === undefined}
                      >
                        <FormControl>
                          <SelectTrigger
                            ref={field.ref}
                            onBlur={field.onBlur}
                            className="w-full"
                          >
                            <SelectValue
                              placeholder={tClassify("levelPlaceholder")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {levels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
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
                  onClick={() => handleOpenChange(false)}
                >
                  {tForm("cancel")}
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
