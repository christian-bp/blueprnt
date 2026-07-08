"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { isValidLevelForTrack, TRACK_LEVELS } from "@workspace/constants"
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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import type { ValidationT } from "@/lib/validation"

// Structural subset of listRoles rows used by the role picker.
export interface AssignableRole {
  roleId: string
  title: string
  trackKey: string
}

// Zod factory (messages via i18n): both selects are required, and the level
// must be valid for the chosen role's track (ADR-0005; the UI only offers
// valid levels, so the refine is the safety net and the backend re-validates).
function makeClassificationSchema(t: ValidationT, roles: AssignableRole[]) {
  return z
    .object({
      roleId: z.string().min(1, t("required")),
      level: z.string().min(1, t("required")),
    })
    .refine(
      (values) => {
        const role = roles.find((r) => String(r.roleId) === values.roleId)
        return (
          role !== undefined &&
          isValidLevelForTrack(role.trackKey, values.level)
        )
      },
      { path: ["level"], message: t("required") }
    )
}

type ClassificationValues = z.infer<ReturnType<typeof makeClassificationSchema>>

// Per-person role + level editing from the person page (the Classify page
// stays the bulk path). Saving writes a CONFIRMED assignment through the same
// assignPersonToRole mutation the classify surface uses. Controlled: the
// trigger lives in PersonActionsMenu.
export function EditClassificationDialog({
  open,
  onOpenChange,
  personId,
  roles,
  current,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: Id<"people">
  roles: AssignableRole[]
  // The person's current assignment; null for a not-yet-classified person
  // (the dialog then assigns rather than edits).
  current: { roleId: string; level: string } | null
}) {
  const t = useTranslations("dashboard.people.detail.editClassification")
  const tDetail = useTranslations("dashboard.people.detail")
  const tHelp = useTranslations("dashboard.help")
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const assignPerson = useMutation(api.people.assignments.assignPersonToRole)

  const schema = useMemo(
    () => makeClassificationSchema(tValidation, roles),
    [tValidation, roles]
  )
  const form = useForm<ClassificationValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      roleId: current?.roleId ?? "",
      level: current?.level ?? "",
    },
  })

  // Re-prime the form from the live assignment each time the dialog opens
  // (the reactive query may have changed it since the last open, and a
  // cancelled edit must not leak into the next one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on open
  useEffect(() => {
    if (open) {
      form.reset({
        roleId: current?.roleId ?? "",
        level: current?.level ?? "",
      })
    }
  }, [open])

  // Destructured at the top so the formState proxy registers the
  // subscriptions on the first render; inline reads inside the (initially
  // unmounted) dialog content register too late and the gate never updates.
  const { isValid, isDirty, isSubmitting } = form.formState

  const selectedRoleId = form.watch("roleId")
  const selectedRole = roles.find((r) => String(r.roleId) === selectedRoleId)
  const levels = selectedRole
    ? (TRACK_LEVELS[selectedRole.trackKey as keyof typeof TRACK_LEVELS] ?? [])
    : []

  async function onSubmit(values: ClassificationValues) {
    try {
      await assignPerson({
        orgId,
        personId,
        roleId: values.roleId as Id<"roles">,
        level: values.level,
        levelSource: "confirmed",
      })
      toast.success(tToast("classificationConfirmed"))
      onOpenChange(false)
    } catch {
      toast.error(tToast("error"))
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
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tDetail("role")}</FormLabel>
                  <Select
                    value={field.value}
                    items={roles.map((role) => ({
                      value: String(role.roleId),
                      label: role.title,
                    }))}
                    onValueChange={(value) => {
                      field.onChange(value)
                      // A role on another track invalidates the picked level:
                      // fall back to the new track's first level (ADR-0005).
                      const role = roles.find((r) => String(r.roleId) === value)
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
                        <SelectValue placeholder={t("rolePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem
                          key={String(role.roleId)}
                          value={String(role.roleId)}
                        >
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
                  <div className="flex items-center gap-1.5">
                    <FormLabel>{tDetail("level")}</FormLabel>
                    <HelpMorphButton label={tHelp("classifyLevelLabel")}>
                      {tHelp("classifyLevelBody")}
                    </HelpMorphButton>
                  </div>
                  {/* Keyed by track: a cross-track role change swaps the level
                      options, and updating the CONTROLLED select in place lets
                      Radix's hidden bubble select sync the new value against
                      the OLD track's options first, firing a spurious
                      onValueChange("") that wipes the field. Remounting mounts
                      options and value together. */}
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
                        <SelectValue placeholder={t("levelPlaceholder")} />
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              {/* Pre-filled edit form: isDirty gates a no-op save (which
                  would still write an assignment + audit row). */}
              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={!isValid || !isDirty || isSubmitting}
              >
                {t("save")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
