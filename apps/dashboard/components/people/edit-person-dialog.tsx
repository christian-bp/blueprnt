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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DatePicker } from "@/components/date-picker"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { numberInputField } from "@/lib/number-field"
import type { ValidationT } from "@/lib/validation"

// The pay-transparency gender categories, mirroring the people table's union.
const GENDER_VALUES = ["Man", "Kvinna"] as const

// Structural subset of listRoles rows used by the role picker (shared with
// the add dialog and the actions menu).
export interface AssignableRole {
  roleId: string
  title: string
  trackKey: string
}

// The editable identity fields, as the dialog receives them from the person
// page (salary lives on its own card).
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
// may be empty, and an emptied field CLEARS the stored value on save. The
// role + level pair is optional as a pair (an unassigned person can stay
// unassigned); a picked role requires a level valid for its track
// (ADR-0005).
function makeEditPersonSchema(t: ValidationT, roles: AssignableRole[]) {
  return z
    .object({
      displayName: z.string().trim().min(1, t("required")),
      gender: z.enum(GENDER_VALUES, { error: t("required") }),
      roleId: z.string(),
      level: z.string(),
      externalRef: z.string().trim(),
      department: z.string().trim(),
      employmentStartDate: z.string(),
      ftePercent: z.number().min(1).max(100).optional(),
    })
    .refine(
      (values) => {
        if (values.roleId === "") return true
        const role = roles.find((r) => r.roleId === values.roleId)
        return (
          role !== undefined &&
          isValidLevelForTrack(role.trackKey, values.level)
        )
      },
      { path: ["level"], message: t("required") }
    )
}

type EditPersonValues = z.infer<ReturnType<typeof makeEditPersonSchema>>

function isPersonRefExistsError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("errors.personRefExists")
  )
}

// Maps a person + assignment to the form's value shape (absent becomes "").
function toFormValues(
  person: EditablePerson,
  currentAssignment: { roleId: string; level: string } | null
): EditPersonValues {
  return {
    displayName: person.displayName,
    gender: person.gender,
    roleId: currentAssignment?.roleId ?? "",
    level: currentAssignment?.level ?? "",
    externalRef: person.externalRef ?? "",
    department: person.department ?? "",
    employmentStartDate: person.employmentStartDate ?? "",
    ftePercent: person.ftePercent ?? undefined,
  }
}

// Full-field editing of an employee from the person page (the actions menu
// carries the trigger): identity details plus the role + level pair in ONE
// dialog. Pre-filled and therefore gated on isDirty as well as isValid, so
// an unchanged form cannot fire a no-op mutation. The backend clears an
// identity field when it receives "" (or null for FTE): an explicit manual
// decision, unlike the import path where an absent field never clears. A
// changed role or level writes a CONFIRMED assignment through the same
// mutation the classify surface uses.
export function EditPersonDialog({
  open,
  onOpenChange,
  person,
  roles,
  currentAssignment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: EditablePerson
  roles: AssignableRole[]
  currentAssignment: { roleId: string; level: string } | null
}) {
  const t = useTranslations("dashboard.people.editPerson")
  const tForm = useTranslations("dashboard.people.personForm")
  const tDetail = useTranslations("dashboard.people.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const tValidation = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const updatePerson = useMutation(api.people.people.updatePerson)
  const assignPerson = useMutation(api.people.assignments.assignPersonToRole)

  const [failure, setFailure] = useState(false)

  const schema = useMemo(
    () => makeEditPersonSchema(tValidation, roles),
    [tValidation, roles]
  )
  const form = useForm<EditPersonValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: toFormValues(person, currentAssignment),
  })

  // Re-prime the form from the live person each time the dialog opens (the
  // reactive query may have changed it since the last open, and a cancelled
  // edit must not leak into the next one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on open
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(person, currentAssignment))
      setFailure(false)
    }
  }, [open])

  // Destructured at the top so the formState proxy registers the
  // subscriptions on the first render; inline reads inside the (initially
  // unmounted) dialog content register too late and the gate never updates.
  const { isValid, isDirty, isSubmitting } = form.formState

  const selectedRoleId = form.watch("roleId")
  const selectedRole = roles.find((r) => r.roleId === selectedRoleId)
  const levels = selectedRole
    ? (TRACK_LEVELS[selectedRole.trackKey as keyof typeof TRACK_LEVELS] ?? [])
    : []

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
    // A changed role/level pair writes a confirmed assignment; unchanged
    // classification writes nothing (effective-dated history stays clean).
    const assignmentChanged =
      values.roleId !== "" &&
      (values.roleId !== (currentAssignment?.roleId ?? "") ||
        values.level !== (currentAssignment?.level ?? ""))
    if (assignmentChanged) {
      try {
        await assignPerson({
          orgId,
          personId: person.personId,
          roleId: values.roleId as Id<"roles">,
          level: values.level,
          levelSource: "confirmed",
        })
      } catch {
        setFailure(true)
        return
      }
    }
    toast.success(tToast("personUpdated"))
    onOpenChange(false)
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
                            shouldDirty: true,
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
                          <SelectValue placeholder={tForm("rolePlaceholder")} />
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
                    {/* Keyed by track: a cross-track role change must remount
                        options and value together (the bubble select
                        otherwise fires a spurious ""). */}
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
                            placeholder={tForm("levelPlaceholder")}
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
                        {...numberInputField(field)}
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
