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
import { toast } from "sonner"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import { type CreateRoleValues, makeCreateRoleSchema } from "@/lib/role-schemas"

// ---------------------------------------------------------------------------
// UnmatchedTitleActions
//
// Renders the "Create role" action for an unmatched title row: a dialog to
// create a new role (family-less), prefilled with the unmatched title, then
// calls onRoleCreated so the parent selects the new role for this row.
// Mapping to an existing role needs no action here: the row's role Select
// is the way to pick one.
// ---------------------------------------------------------------------------

// Structural subset: key is string at the JS layer; the form schema validates
// that it is a known track literal before submitting.
interface TrackOption {
  key: string
  name: string
  order: number
}

export function UnmatchedTitleActions({
  orgId,
  title,
  tracks,
  onRoleCreated,
}: {
  orgId: string
  title: string
  tracks: TrackOption[]
  onRoleCreated: (roleId: Id<"roles">) => void
}) {
  const t = useTranslations("dashboard.classify")
  const tCreate = useTranslations("dashboard.classify.createRole")
  const tHelp = useTranslations("dashboard.help")
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

  const form = useForm<CreateRoleValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title,
      roleFunction: "",
      team: "",
      trackKey: (firstTrack?.key ?? "IC") as CreateRoleValues["trackKey"],
      familyId: null,
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      form.reset({
        title,
        roleFunction: "",
        team: "",
        trackKey: (firstTrack?.key ?? "IC") as CreateRoleValues["trackKey"],
        familyId: null,
      })
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCreate("title")}</DialogTitle>
            <DialogDescription>{tCreate("description")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCreate("titleLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <FormLabel>{tCreate("functionLabel")}</FormLabel>
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
                      <FormLabel>{tCreate("teamLabel")}</FormLabel>
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
                      <FormLabel>{tCreate("trackLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("trackLabel")}>
                        {tHelp("trackBody")}
                      </HelpMorphButton>
                    </div>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={tracks.map((track) => ({
                        value: track.key,
                        label: track.name,
                      }))}
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
