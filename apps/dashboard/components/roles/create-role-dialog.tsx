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
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Form } from "@workspace/ui/components/form"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { useMemo, useState } from "react"
import type * as React from "react"
import { useForm } from "react-hook-form"
import {
  RoleFormFields,
  type RoleFormTrack,
} from "@/components/role-form-fields"
import { SubmitButton } from "@/components/submit-button"
import { isDuplicateRoleError } from "@/lib/role-error"
import { type CreateRoleValues, makeCreateRoleSchema } from "@/lib/role-schemas"
import { FORM_DIALOG_CONTENT } from "@/lib/dialog-style"

// Structural subset of getModel's tracks: the stable key flows through to the
// mutation untouched. Narrows the shared form's track shape to the schema's
// track union, so the dialog and the client gate share one definition (the
// schema in turn mirrors the backend trackKeyValidator, ADR-0006).
export interface TrackOption extends RoleFormTrack {
  key: CreateRoleValues["trackKey"]
  order: number
}

// Creates a role from its identity AND its job profile: purpose and
// responsibilities can be typed here or drafted with AI, so a role can be
// created complete instead of created empty and edited on the role page. Both
// profile fields stay optional (profileComplete gates rating, not creation).
export function CreateRoleDialog({
  orgId,
  tracks,
  triggerLabel,
  existing,
  defaultFamilyId = null,
  // The roles page demotes this to the secondary action beside the import, the
  // way the people header does. Defaults to the primary button everywhere else
  // (the family page keeps it as its main action).
  triggerVariant,
}: {
  orgId: string
  tracks: TrackOption[]
  triggerLabel: string
  // The org's current roles, so the form rejects a title already taken in the
  // selected family before submitting (the backend stays the authority).
  existing: { title: string; familyId: string | null }[]
  // When set, the role is created in this family and the family picker is
  // hidden: used from a family page, where the family is the fixed context.
  defaultFamilyId?: string | null
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const t = useTranslations("dashboard.roles.create")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const createRole = useMutation(api.assessment.roles.createRole)
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  const firstTrack = tracks[0]

  const schema = useMemo(
    () => makeCreateRoleSchema(tv, existing, tErrors("roleExists")),
    [tv, existing, tErrors]
  )
  const form = useForm<CreateRoleValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      roleFunction: "",
      team: "",
      trackKey: firstTrack?.key ?? "IC",
      familyId: defaultFamilyId,
      purpose: "",
      responsibilities: "",
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    // Closing discards the draft: a reopened dialog always starts clean.
    if (!nextOpen) {
      form.reset()
      setFailure(null)
    }
  }

  async function onSubmit(values: CreateRoleValues) {
    setFailure(null)
    try {
      const { slug } = await createRole({
        orgId,
        title: values.title,
        function: values.roleFunction,
        team: values.team,
        trackKey: values.trackKey,
        ...(values.familyId !== null
          ? { familyId: values.familyId as never }
          : {}),
        // The profile fields are optional: send them only when filled, so an
        // untouched create writes exactly what it did before.
        ...(values.purpose !== "" ? { purpose: values.purpose } : {}),
        ...(values.responsibilities !== ""
          ? { responsibilities: values.responsibilities }
          : {}),
      })
      // createRole returns the stored slug (with any uniqueness suffix), so we
      // navigate straight to the new role's slug-based route.
      toast.success(tToast("roleCreated"))
      setOpen(false)
      router.push(`/roles/${slug}`)
    } catch (error) {
      setFailure(isDuplicateRoleError(error) ? "duplicate" : "generic")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={triggerVariant} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className={FORM_DIALOG_CONTENT}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RoleFormFields
              orgId={orgId}
              form={form}
              tracks={tracks}
              showFamily={defaultFamilyId === null}
              labels={{
                title: t("titleLabel"),
                titlePlaceholder: t("titlePlaceholder"),
                roleFunction: t("functionLabel"),
                team: t("teamLabel"),
                track: t("trackLabel"),
              }}
            />
            {failure !== null && (
              <p role="alert" className="text-destructive text-sm">
                {failure === "duplicate" ? tErrors("roleExists") : t("error")}
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
  )
}
