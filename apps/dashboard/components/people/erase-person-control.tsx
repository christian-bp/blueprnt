"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useOrganization } from "@/components/org-context"

// Type-to-confirm erasure dialog. Mirrors the gate pattern in
// admin/delete-user-dialog: RHF + a refine on the runtime token so
// form.formState.isValid tracks "typed text equals the required token",
// which gates the destructive AlertDialogAction. The input is a plain
// register()ed field (no FormControl) so a partial match never glows the
// field destructive-red. Calls the org-scoped erasePersonAsOrg on confirm,
// then navigates to /people. Controlled: the trigger lives in
// PersonActionsMenu (the page's unified "..." menu), not here.
export function ErasePersonControl({
  open,
  onOpenChange,
  personId,
  displayName,
  externalRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: Id<"people">
  displayName: string
  externalRef: string | null
}) {
  const t = useTranslations("dashboard.people.erase")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const erasePerson = useMutation(api.people.erase.erasePersonAsOrg)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // The required token: the employee number when present, else "DELETE".
  const token = externalRef ?? "DELETE"
  const inputId = `confirm-erase-${String(personId)}`

  // Schema closes over the runtime token so it is built inline, not a shared
  // factory. No message: the gate shows no inline field error.
  const schema = useMemo(
    () =>
      z.object({
        confirmText: z.string().refine((v) => v.trim() === token),
      }),
    [token]
  )
  const form = useForm<{ confirmText: string }>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { confirmText: "" },
  })
  const confirmed = form.formState.isValid

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset({ confirmText: "" })
      setFailed(false)
    }
    onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed) return
    setBusy(true)
    setFailed(false)
    try {
      await erasePerson({ orgId, personId })
      toast.success(tToast("personErased"))
      handleOpenChange(false)
      router.push("/people")
    } catch {
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("title", { name: displayName })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={inputId}>
            {externalRef !== null
              ? t("confirmLabel", { externalRef })
              : t("confirmNoRef")}
          </Label>
          <Input
            id={inputId}
            autoComplete="off"
            {...form.register("confirmText")}
          />
        </div>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || busy}
            onClick={(event) => {
              // Keep the dialog mounted; we close it ourselves on success.
              event.preventDefault()
              void handleDelete()
            }}
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
