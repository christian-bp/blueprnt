"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionForm } from "@/components/model/criterion-form"

// Wraps the shared CriterionForm in a dialog so the tall form does not push
// the criteria list down. The trigger reuses the existing addCta button
// styling; a successful add closes the dialog. Open state is controlled so
// the close is driven from the add result, not a stray click. The new
// criterion animates into the parent list (AnimatePresence) once the
// reactive getModel query picks it up; the list stays mounted throughout.
export function AddCriterionDialog({ orgId }: { orgId: string }) {
  const tEditor = useTranslations("dashboard.model.editor")
  const addCriterion = useMutation(api.evaluationModel.criteria.addCriterion)
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
        <CriterionForm
          submitLabel={tEditor("addCta")}
          onCancel={() => setOpen(false)}
          onSubmit={async (values) => {
            await addCriterion({ orgId, ...values })
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
