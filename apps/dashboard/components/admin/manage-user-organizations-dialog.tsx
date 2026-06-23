"use client"

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
import { useState } from "react"
import type { MembershipRole } from "@/lib/admin-schemas"

export function ManageUserOrganizationsDialog(props: {
  user: { authId: string; name: string; email: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user, open, onOpenChange } = props
  const t = useTranslations("dashboard.admin.users.organizations")
  const tRole = useTranslations("accounts.role")

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

  const [addOrgId, setAddOrgId] = useState("")
  const [addRole, setAddRole] = useState<MembershipRole>("editor")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

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
    } catch {
      setError(true)
    }
  }

  async function handleRemove(orgId: string) {
    setError(false)
    try {
      await removeMembership({ authId: user.authId, orgId })
    } catch {
      setError(true)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addOrgId === "") return
    setError(false)
    setBusy(true)
    try {
      await addMembership({
        authId: user.authId,
        orgId: addOrgId,
        role: addRole,
      })
      setAddOrgId("")
    } catch {
      setError(true)
    } finally {
      setBusy(false)
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
            <form onSubmit={handleAdd}>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1 space-y-2">
                  <Label>{t("orgLabel")}</Label>
                  <Select
                    value={addOrgId}
                    onValueChange={setAddOrgId}
                    name="orgId"
                  >
                    <SelectTrigger aria-label={t("orgLabel")}>
                      <SelectValue placeholder={t("orgPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {addableOrgs.map((o) => (
                        <SelectItem key={o.orgId} value={o.orgId}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36 space-y-2">
                  <Label>{t("roleLabel")}</Label>
                  <Select
                    value={addRole}
                    onValueChange={(value) =>
                      setAddRole(value as MembershipRole)
                    }
                    name="role"
                  >
                    <SelectTrigger aria-label={t("roleLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{tRole("admin")}</SelectItem>
                      <SelectItem value="editor">{tRole("editor")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label aria-hidden className="invisible">
                    {t("addCta")}
                  </Label>
                  <Button type="submit" disabled={addOrgId === "" || busy}>
                    {t("addCta")}
                  </Button>
                </div>
              </div>
            </form>
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
