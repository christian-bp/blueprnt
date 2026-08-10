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
import { Form } from "@workspace/ui/components/form"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "@/lib/toast"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import {
  RoleFormFields,
  type RoleFormTrack,
} from "@/components/role-form-fields"
import { SubmitButton } from "@/components/submit-button"
import { type CreateRoleValues, makeCreateRoleSchema } from "@/lib/role-schemas"
import { FORM_DIALOG_CONTENT } from "@/lib/dialog-style"

// ---------------------------------------------------------------------------
// UnmatchedTitleActions
//
// Renders the "Create role" action for an unmatched title row: a dialog to
// create a new role (family-less), prefilled with the unmatched title, then
// calls onRoleCreated so the parent selects the new role for this row. The
// dialog carries the full job profile (purpose, responsibilities, and the AI
// draft), so a role created while classifying is ready to rate.
// Mapping to an existing role needs no action here: the row's role Select
// is the way to pick one.
// ---------------------------------------------------------------------------

export function UnmatchedTitleActions({
  orgId,
  title,
  tracks,
  onRoleCreated,
}: {
  orgId: string
  title: string
  tracks: (RoleFormTrack & { order: number })[]
  onRoleCreated: (roleId: Id<"roles">) => void
}) {
  const t = useTranslations("dashboard.classify")
  const tCreate = useTranslations("dashboard.classify.createRole")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")

  const createRole = useMutation(api.assessment.roles.createRole)

  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<"generic" | null>(null)

  const firstTrack = tracks[0]

  // Classification create is family-less: no existing-title duplicate check is
  // needed here (the backend is the authority; we omit the client-side gate
  // because we have no family context to scope the check to).
  const schema = useMemo(
    () => makeCreateRoleSchema(tv, [], tErrors("roleExists")),
    [tv, tErrors]
  )

  // One definition of the empty form, used both to seed it and to reset it on
  // close, so the two can never disagree about what "clean" means.
  const defaults: CreateRoleValues = useMemo(
    () => ({
      title,
      roleFunction: "",
      team: "",
      trackKey: (firstTrack?.key ?? "IC") as CreateRoleValues["trackKey"],
      familyId: null,
      purpose: "",
      responsibilities: "",
    }),
    [title, firstTrack?.key]
  )

  const form = useForm<CreateRoleValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults,
  })

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      form.reset(defaults)
      setFailure(null)
    }
  }

  async function onSubmit(values: CreateRoleValues) {
    setFailure(null)
    try {
      // Classification create is family-less: omit familyId entirely.
      const result = await createRole({
        orgId,
        title: values.title,
        function: values.roleFunction,
        team: values.team,
        trackKey: values.trackKey,
        // The profile fields are optional: send them only when filled, so an
        // untouched create writes exactly what it did before.
        ...(values.purpose !== "" ? { purpose: values.purpose } : {}),
        ...(values.responsibilities !== ""
          ? { responsibilities: values.responsibilities }
          : {}),
      })
      toast.success(tToast("roleCreated"))
      setOpen(false)
      // The page's listRoles query is reactive; the new role will appear in
      // the Select options without a manual refetch. Select it for this row.
      onRoleCreated(result.roleId as Id<"roles">)
    } catch {
      setFailure("generic")
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Default size (h-9): this button sits on one line with the h-9 role
          select; size="sm" was a leftover from its former life inside the
          table's actions cell. */}
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("createRoleCta")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={FORM_DIALOG_CONTENT}>
          <DialogHeader>
            <DialogTitle>{tCreate("title")}</DialogTitle>
            <DialogDescription>{tCreate("description")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <RoleFormFields
                orgId={orgId}
                form={form}
                tracks={tracks}
                showFamily={false}
                labels={{
                  title: tCreate("titleLabel"),
                  roleFunction: tCreate("functionLabel"),
                  team: tCreate("teamLabel"),
                  track: tCreate("trackLabel"),
                }}
              />
              {failure !== null && (
                <p role="alert" className="text-destructive text-sm">
                  {tCreate("error")}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  {tCreate("cancel")}
                </Button>
                <SubmitButton
                  type="submit"
                  isSubmitting={form.formState.isSubmitting}
                  disabled={!form.formState.isValid}
                >
                  {tCreate("cta")}
                </SubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
