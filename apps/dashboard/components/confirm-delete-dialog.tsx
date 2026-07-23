"use client"

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
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// Controlled destructive-confirmation dialog. Backs any destructive action that
// needs a confirmation step (for example: family Delete, role Archive). The menu
// item that opens it sets `open`; on confirm it runs `onConfirm` then closes.
// `children` render between the description and the footer (for example, the
// list of affected roles).
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => Promise<void> | void
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            className="relative"
            onClick={async () => {
              // A rejected onConfirm means the action failed (the caller
              // already toasted the error): keep the dialog open so the
              // user can retry, instead of closing on a failed delete.
              try {
                await onConfirm()
              } catch {
                return
              }
              onOpenChange(false)
            }}
          >
            {/* SubmitButton's overlay anatomy: the label keeps its width
                (invisible, not removed) so nothing reflows mid-delete. */}
            <span
              className={cn(
                "inline-flex items-center gap-[inherit]",
                pending && "invisible"
              )}
            >
              {confirmLabel}
            </span>
            {pending && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner />
              </div>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
