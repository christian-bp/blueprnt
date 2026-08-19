"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  CRITERIA_LIBRARY_KEYS,
  type CriteriaLibraryKey,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import type { DimensionKey } from "@workspace/core"
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
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"

// Cap errors get their own translated message (surfaced as a toast, per the
// picker's minimal design); anything else falls back to the generic toast.
const KNOWN_ERROR_KEYS = [
  "dimensionCapExceeded",
  "tooManyCriteria",
  "criterionAlreadySelected",
] as const

function errorMessage(
  error: unknown,
  tErrors: (key: (typeof KNOWN_ERROR_KEYS)[number]) => string,
  fallback: string
): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return tErrors(known)
  }
  return fallback
}

// The library picker: one per dimension section, listing that dimension's
// unselected library entries (name + shortUiText) with an Add button per row.
// Library-only selection (ADR-0021 addendum, decision 8): there is no
// create-text path, only a criterion to turn on. Cap errors (dimension/model
// caps, already-selected) surface as error toasts rather than inline text,
// since the dialog can stay open across several adds in one visit.
export function LibraryPickerDialog({
  orgId,
  dimensionKey,
  dimensionName,
  selectedKeys,
}: {
  orgId: string
  dimensionKey: DimensionKey
  dimensionName: string
  selectedKeys: readonly string[]
}) {
  const t = useTranslations("dashboard.model.picker")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const locale = useLocale()
  const activateCriterion = useMutation(
    api.evaluationModel.criteria.activateCriterion
  )
  const [open, setOpen] = useState(false)
  const [addingKey, setAddingKey] = useState<CriteriaLibraryKey | null>(null)

  const content = criteriaLibraryContent(locale)
  const selected = new Set(selectedKeys)
  const entries = CRITERIA_LIBRARY_KEYS.filter(
    (key) => LIBRARY_DIMENSION[key] === dimensionKey && !selected.has(key)
  ).map((key) => ({ key, ...content.criteria[key] }))

  async function onAdd(key: CriteriaLibraryKey) {
    setAddingKey(key)
    try {
      await activateCriterion({ orgId, libraryKey: key })
      toast.success(tToast("criterionActivated"))
      // Close once the dimension has nothing left to add, so the dialog never
      // lingers open on an empty list.
      if (entries.length <= 1) setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error, tErrors, tToast("error")))
    } finally {
      setAddingKey(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        {t("addCta")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("dialogTitle", { dimension: dimensionName })}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.key}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {entry.shortUiText}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={addingKey !== null}
                  onClick={() => onAdd(entry.key)}
                >
                  {t("addRowCta")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("closeCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
