"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { z } from "zod"

// Controlled type-to-confirm dialog: the owning section drives open state and
// supplies the target user. The row-actions menu carries the "Delete user"
// label, so this component renders only the AlertDialog (no trigger button).
//
// This is a confirmation GATE, not a data-entry form: RHF + a refine on the
// runtime email exist only so form.formState.isValid tracks "the typed text
// equals the email", which gates the destructive action. The input is bound via
// register and rendered as a plain field (no FormControl) on purpose: routing
// it through FormControl would set aria-invalid while the user types a partial
// (not-yet-matching) email, glowing the field destructive-red, which is exactly
// the nagging a confirm gate must not do.
export function DeleteUserDialog(props: {
  authId: string
  name: string
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.admin.users.delete")
  const tToast = useTranslations("dashboard.toast")
  const deleteUser = useMutation(api.platform.admin.deleteUser)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputId = `confirm-${props.authId}`

  // The schema closes over the runtime email, so it is built inline (not a
  // shared factory). No message: the gate shows no inline error.
  const schema = useMemo(
    () =>
      z.object({
        confirmText: z.string().refine((v) => v.trim() === props.email),
      }),
    [props.email]
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
    props.onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed) return
    setBusy(true)
    setFailed(false)
    try {
      await deleteUser({ authId: props.authId })
      toast.success(tToast("userDeleted"))
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
          <Label htmlFor={inputId}>
            {t("confirmLabel", { email: props.email })}
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
