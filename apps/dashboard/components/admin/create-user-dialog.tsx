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
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { SubmitButton } from "@/components/submit-button"
import {
  type CreateUserValues,
  makeCreateUserSchema,
} from "@/lib/admin-schemas"
import { authClient } from "@/lib/auth-client"

export function CreateUserDialog() {
  const t = useTranslations("dashboard.admin.users.create")
  const tAccounts = useTranslations("accounts")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const createUser = useMutation(api.platform.admin.createUser)
  const organizations = useQuery(api.platform.admin.listOrganizations)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeCreateUserSchema(tv), [tv])
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", orgId: "", role: "editor" },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setFailed(false)
    }
  }

  async function onSubmit(values: z.output<typeof schema>) {
    setFailed(false)
    try {
      await createUser(values)
      // Send the set-password email. A failure here is non-fatal: the account
      // exists and the invite can be resent from the users table.
      await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      })
      toast.success(tToast("userCreated"))
      handleOpenChange(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("cta")}</Button>
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
              name="name"
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailLabel")}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orgLabel")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={organizations === undefined}
                  >
                    <FormControl>
                      <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                        <SelectValue placeholder={t("orgPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(organizations ?? []).map((o) => (
                        <SelectItem key={o.orgId} value={o.orgId}>
                          {o.name}
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("roleLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="editor">
                        {tAccounts("role.editor")}
                      </SelectItem>
                      <SelectItem value="admin">
                        {tAccounts("role.admin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {failed && (
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
  )
}
