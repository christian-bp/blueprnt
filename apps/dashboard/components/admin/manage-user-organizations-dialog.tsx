"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Label } from "@workspace/ui/components/label"
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
import { SubmitButton } from "@/components/submit-button"
import {
  type AddMembershipValues,
  makeAddMembershipSchema,
  type MembershipRole,
} from "@/lib/admin-schemas"

export function ManageUserOrganizationsDialog(props: {
  user: { authId: string; name: string; email: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user, open, onOpenChange } = props
  const t = useTranslations("dashboard.admin.users.organizations")
  const tRole = useTranslations("accounts.role")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")

  const memberships = useQuery(
    api.platform.admin.listOrganizationsForUser,
    open ? { authId: user.authId } : "skip"
  )
  const allOrgs = useQuery(
    api.platform.admin.listOrganizations,
    open ? {} : "skip"
  )
  const addMembership = useMutation(api.platform.admin.addMembership)
  const setMembershipRole = useMutation(api.platform.admin.setMembershipRole)
  const removeMembership = useMutation(api.platform.admin.removeMembership)

  const [error, setError] = useState(false)

  const schema = useMemo(() => makeAddMembershipSchema(tv), [tv])
  const form = useForm<AddMembershipValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { orgId: "", role: "editor" },
  })

  const memberOrgIds = new Set((memberships ?? []).map((m) => m.orgId))
  const addableOrgs = (allOrgs ?? []).filter((o) => !memberOrgIds.has(o.orgId))

  async function handleRoleChange(orgId: string, value: string) {
    setError(false)
    try {
      await setMembershipRole({
        authId: user.authId,
        orgId,
        role: value as MembershipRole,
      })
      toast.success(tToast("membershipUpdated"))
    } catch {
      setError(true)
    }
  }

  async function handleRemove(orgId: string) {
    setError(false)
    try {
      await removeMembership({ authId: user.authId, orgId })
      toast.success(tToast("membershipRemoved"))
    } catch {
      setError(true)
    }
  }

  async function onAdd(values: AddMembershipValues) {
    setError(false)
    try {
      await addMembership({
        authId: user.authId,
        orgId: values.orgId,
        role: values.role,
      })
      toast.success(tToast("membershipAdded"))
      form.reset({ orgId: "", role: "editor" })
    } catch {
      setError(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: user.name })}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="font-medium text-sm">{t("currentHeading")}</h3>
          {memberships !== undefined && memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noMemberships")}
            </p>
          ) : (
            <ul className="space-y-2">
              {(memberships ?? []).map((m) => (
                <li
                  key={m.orgId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={(value) =>
                        handleRoleChange(m.orgId, value)
                      }
                    >
                      <SelectTrigger
                        className="w-32"
                        aria-label={t("roleLabel")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{tRole("admin")}</SelectItem>
                        <SelectItem value="editor">
                          {tRole("editor")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("memberActions", { name: m.name })}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            strokeWidth={2}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleRemove(m.orgId)}
                        >
                          {t("removeCta")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium text-sm">{t("addHeading")}</h3>
          {allOrgs !== undefined && addableOrgs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noOrgsAvailable")}
            </p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAdd)}>
                <div className="flex flex-wrap items-end gap-2">
                  <FormField
                    control={form.control}
                    name="orgId"
                    render={({ field }) => (
                      <FormItem className="min-w-48 flex-1">
                        <FormLabel>{t("orgLabel")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger
                              ref={field.ref}
                              onBlur={field.onBlur}
                              aria-label={t("orgLabel")}
                            >
                              <SelectValue placeholder={t("orgPlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {addableOrgs.map((o) => (
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
                      <FormItem className="w-36">
                        <FormLabel>{t("roleLabel")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger
                              ref={field.ref}
                              onBlur={field.onBlur}
                              aria-label={t("roleLabel")}
                            >
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">
                              {tRole("admin")}
                            </SelectItem>
                            <SelectItem value="editor">
                              {tRole("editor")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label aria-hidden className="invisible">
                      {t("addCta")}
                    </Label>
                    <SubmitButton
                      type="submit"
                      isSubmitting={form.formState.isSubmitting}
                      disabled={!form.formState.isValid}
                    >
                      {t("addCta")}
                    </SubmitButton>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </section>

        {error && (
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
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
