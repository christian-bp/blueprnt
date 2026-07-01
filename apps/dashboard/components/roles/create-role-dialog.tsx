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
import { HelpMorphButton } from "@/components/help-morph-button"
import { FamilyPicker } from "@/components/roles/family-picker"
import { SubmitButton } from "@/components/submit-button"
import { isDuplicateRoleError } from "@/lib/role-error"
import { type CreateRoleValues, makeCreateRoleSchema } from "@/lib/role-schemas"

// Structural subset of getModel's tracks: the stable key flows through to the
// mutation untouched. The key type is sourced from the schema's track union so
// the dialog and the client gate share one definition (the schema in turn
// mirrors the backend trackKeyValidator, ADR-0006).
export interface TrackOption {
  key: CreateRoleValues["trackKey"]
  name: string
  order: number
}

// The basics only (title, function, team, track): purpose and
// responsibilities are filled on the role page, by hand or via the AI draft.
export function CreateRoleDialog({
  orgId,
  tracks,
  triggerLabel,
  existing,
  defaultFamilyId = null,
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
}) {
  const t = useTranslations("dashboard.roles.create")
  const tHelp = useTranslations("dashboard.help")
  const tModel = useTranslations("model")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
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
      })
      // createRole returns the stored slug (with any uniqueness suffix), so we
      // navigate straight to the new role's slug-based route.
      setOpen(false)
      router.push(`/roles/${slug}`)
    } catch (error) {
      setFailure(isDuplicateRoleError(error) ? "duplicate" : "generic")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("titleLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("titlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="roleFunction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("functionLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="team"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="trackKey"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>{t("trackLabel")}</FormLabel>
                    <HelpMorphButton label={tHelp("trackLabel")}>
                      {tHelp("trackBody")}
                    </HelpMorphButton>
                  </div>
                  <Select value={field.value} onValueChange={field.onChange}>
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
                      {tracks.map((track) => (
                        <SelectItem key={track.key} value={track.key}>
                          {track.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {defaultFamilyId === null && (
              <FormField
                control={form.control}
                name="familyId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>{tModel("roleFamily")}</FormLabel>
                      <HelpMorphButton label={tHelp("familyLabel")}>
                        {tHelp("familyBody")}
                      </HelpMorphButton>
                    </div>
                    <FormControl>
                      <FamilyPicker
                        orgId={orgId}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value)
                          // The family is the uniqueness scope, so re-check the
                          // title against the newly selected family.
                          void form.trigger("title")
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
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
