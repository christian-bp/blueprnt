"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AddCriterionForm } from "@/components/model/add-criterion-form"

// Wraps AddCriterionForm in a dialog so the tall form does not push the criteria
// list down. The trigger reuses the existing addCta button styling; the form
// closes the dialog on a successful add via its onAdded callback. Open state is
// controlled so the close is driven from the add result, not a stray click.
// The new criterion animates into the parent list (AnimatePresence) once the
// reactive getModel query picks it up; the list stays mounted throughout.
export function AddCriterionDialog({ orgId }: { orgId: string }) {
  const tEditor = useTranslations("dashboard.model.editor")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {tEditor("addCta")}
        </Button>
      </DialogTrigger>
      {/* The form is tall; cap the height and scroll inside so the dialog stays
          centered and the overlay shifts nothing behind it. */}
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tEditor("addCta")}</DialogTitle>
          <DialogDescription>
            {tEditor("addDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <AddCriterionForm
          orgId={orgId}
          onAdded={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
