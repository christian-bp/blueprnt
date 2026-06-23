"use client"

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
import { Input } from "@workspace/ui/components/input"
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
import { SubmitButton } from "@/components/submit-button"
import { createUserSchema } from "@/lib/admin-schemas"
import { authClient } from "@/lib/auth-client"

export function CreateUserDialog() {
  const t = useTranslations("dashboard.admin.users.create")
  const tAccounts = useTranslations("accounts")
  const createUser = useMutation(api.platform.admin.createUser)
  const organizations = useQuery(api.platform.admin.listOrganizations)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [orgId, setOrgId] = useState("")
  const [role, setRole] = useState<"admin" | "editor">("editor")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const parsed = createUserSchema.safeParse({ name, email, orgId, role })
  const canSubmit = parsed.success && !pending

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName("")
      setEmail("")
      setOrgId("")
      setRole("editor")
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success) return
    setPending(true)
    setFailed(false)
    try {
      await createUser({
        name: parsed.data.name,
        email: parsed.data.email,
        orgId: parsed.data.orgId,
        role: parsed.data.role,
      })
      // Send the set-password email. A failure here is non-fatal: the account
      // exists and the invite can be resent from the users table.
      await authClient.requestPasswordReset({
        email: parsed.data.email,
        redirectTo: "/reset-password",
      })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">{t("nameLabel")}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">{t("emailLabel")}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-org">{t("orgLabel")}</Label>
            <Select
              value={orgId}
              onValueChange={setOrgId}
              disabled={organizations === undefined}
            >
              <SelectTrigger id="user-org">
                <SelectValue placeholder={t("orgPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(organizations ?? []).map((o) => (
                  <SelectItem key={o.orgId} value={o.orgId}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">{t("roleLabel")}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "admin" | "editor")}
            >
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">
                  {tAccounts("role.editor")}
                </SelectItem>
                <SelectItem value="admin">{tAccounts("role.admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              isSubmitting={pending}
              disabled={!canSubmit}
            >
              {t("cta")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
