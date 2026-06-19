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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { createUserSchema } from "@/lib/admin-schemas"
import { authClient } from "@/lib/auth-client"

export function CreateUserDialog() {
  const t = useTranslations("dashboard.admin.users.create")
  const createUser = useMutation(api.platform.admin.createUser)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const parsed = createUserSchema.safeParse({ name, email })
  const canSubmit = parsed.success && !pending

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName("")
      setEmail("")
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success) return
    setPending(true)
    setFailed(false)
    try {
      await createUser({ name: parsed.data.name, email: parsed.data.email })
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
            <Button type="submit" disabled={!canSubmit}>
              {t("cta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
