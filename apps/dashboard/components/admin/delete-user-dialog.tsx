"use client"

import { api } from "@workspace/backend/convex/_generated/api"
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
import { useState } from "react"

// Controlled type-to-confirm dialog: the owning section drives open state and
// supplies the target user. The row-actions menu carries the "Delete user"
// label, so this component renders only the AlertDialog (no trigger button).
export function DeleteUserDialog(props: {
  authId: string
  name: string
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.admin.users.delete")
  const deleteUser = useMutation(api.platform.admin.deleteUser)
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirmed = confirmText.trim() === props.email

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmText("")
      setFailed(false)
    }
    props.onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed) return
    setBusy(true)
    setFailed(false)
    try {
      await deleteUser({ authId: props.authId })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={props.open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("title", { name: props.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`confirm-${props.authId}`}>
            {t("confirmLabel", { email: props.email })}
          </Label>
          <Input
            id={`confirm-${props.authId}`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
        </div>
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
