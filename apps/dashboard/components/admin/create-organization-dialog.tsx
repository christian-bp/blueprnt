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
import { createOrgSchema } from "@/lib/admin-schemas"

export function CreateOrganizationDialog() {
  const t = useTranslations("dashboard.admin.orgs.create")
  const createOrg = useMutation(api.platform.admin.createOrganization)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const parsed = createOrgSchema.safeParse({ name, slug })
  const canSubmit = parsed.success && !pending

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName("")
      setSlug("")
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success) return
    setPending(true)
    setFailed(false)
    try {
      await createOrg({ name: parsed.data.name, slug: parsed.data.slug })
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
            <Label htmlFor="org-name">{t("nameLabel")}</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">{t("slugLabel")}</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
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
