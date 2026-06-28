"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import { type InviteValues, makeInviteSchema } from "@/lib/organization-schemas"

// Invite-by-email dialog. Sends through the Better Auth organization client
// (which fires the wired sendInvitationEmail + the invitation.created audit
// trigger). Admin is enforced by the access-control roles and by this surface
// being admin-only. Calls onInvited so the pending-invitations list refreshes.
export function InviteMemberDialog(props: {
  orgId: string
  onInvited: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.organization.invite")
  const tv = useTranslations("dashboard.validation")
  const tm = useTranslations("dashboard.organization.members")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)

  const schema = useMemo(() => makeInviteSchema(tv), [tv])
  const form = useForm<InviteValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "", role: "editor" },
  })
  const { isValid, isSubmitting } = form.formState

  function reset() {
    setError(false)
    form.reset({ email: "", role: "editor" })
  }

  async function onSubmit(values: InviteValues) {
    setError(false)
    const { error: inviteError } = await authClient.organization.inviteMember({
      email: values.email,
      role: values.role,
      organizationId: props.orgId,
    })
    if (inviteError) {
      setError(true)
      return
    }
    setOpen(false)
    reset()
    await props.onInvited()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">{t("cta")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="invite-member-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailLabel")}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("roleLabel")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t("roleLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">
                          {tm("roleEditor")}
                        </SelectItem>
                        <SelectItem value="admin">{tm("roleAdmin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {tm("cancel")}
          </Button>
          <SubmitButton
            type="submit"
            form="invite-member-form"
            isSubmitting={isSubmitting}
            disabled={!isValid}
          >
            {t("submit")}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
