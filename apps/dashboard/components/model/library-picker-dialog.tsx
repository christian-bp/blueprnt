"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  CRITERIA_LIBRARY_KEYS,
  type CriteriaLibraryKey,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
  LIBRARY_OVERLAP_PAIRS,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import type { DimensionKey } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"

// Constructing an Intl formatter is the expensive part of using one, and a
// dimension's library is a whole list of rows re-rendering together. One
// formatter per locale, reused.
const listFormatters = new Map<string, Intl.ListFormat>()

function formatNames(locale: string, names: readonly string[]): string {
  let formatter = listFormatters.get(locale)
  if (formatter === undefined) {
    formatter = new Intl.ListFormat(locale, {
      style: "short",
      type: "conjunction",
    })
    listFormatters.set(locale, formatter)
  }
  return formatter.format(names)
}

// A criterion the org has already chosen, as this dialog needs to know it:
// which library entry it is (so the row is not offered twice) and what it is
// called (so an overlap can be named rather than counted).
export interface SelectedCriterion {
  libraryKey: string
  name: string
}

// The library picker, scoped to one dimension: every criterion that dimension
// still offers, with what the reader has to weigh about each one, and one
// press to put it in the model.
//
// Library-only selection (ADR-0021 addendum, decision 8): there is no
// free-text criterion editor, only a criterion to turn on. It enters at weight
// 3 and is weighted in the Viktning chapter, which the dialog's own
// description says, because the row itself carries no weight control.
export function LibraryPickerDialog({
  orgId,
  dimensionKey,
  dimensionName,
  selected,
  recommendedKeys,
}: {
  orgId: string
  dimensionKey: DimensionKey
  dimensionName: string
  selected: readonly SelectedCriterion[]
  // The org's industry hints point at these criteria. A hint, never a
  // selection: the company still chooses and documents its own criteria.
  recommendedKeys: readonly string[]
}) {
  const t = useTranslations("dashboard.model.picker")
  // The chapter's own chip wording: a chip means the same thing on the row it
  // is chosen from as it would anywhere else in the chapter.
  const tCriteria = useTranslations("dashboard.model.criteria")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const locale = useLocale()
  const activateCriterion = useMutation(
    api.evaluationModel.criteria.activateCriterion
  )
  const [open, setOpen] = useState(false)
  // The criteria whose activation is in flight, by library key. The Set in the
  // ref is the authority and the array in state exists only to render from: a
  // double press has to be answered synchronously, inside the gesture, and a
  // state value read from a render closure is a tick behind exactly then.
  const addingRef = useRef<Set<string>>(new Set())
  const [addingKeys, setAddingKeys] = useState<readonly string[]>([])

  const content = criteriaLibraryContent(locale)
  const selectedKeys = new Set(
    selected.map((criterion) => criterion.libraryKey)
  )
  const selectedNames = new Map(
    selected.map((criterion) => [criterion.libraryKey, criterion.name])
  )
  const entries = CRITERIA_LIBRARY_KEYS.filter(
    (key) => LIBRARY_DIMENSION[key] === dimensionKey && !selectedKeys.has(key)
  )

  // The already-chosen criteria this one overlaps, by name. Named rather than
  // counted: "overlaps something" is a warning nobody can act on.
  function overlapsSelected(libraryKey: string): string[] {
    const names: string[] = []
    for (const [first, second] of LIBRARY_OVERLAP_PAIRS) {
      const partner =
        first === libraryKey ? second : second === libraryKey ? first : null
      if (partner === null) continue
      const name = selectedNames.get(partner)
      if (name !== undefined) names.push(name)
    }
    return names
  }

  function errorToast(error: unknown) {
    const known = modelErrorKey(error)
    toast.error(known === undefined ? tToast("error") : tErrors(known))
  }

  async function runAdd(libraryKey: CriteriaLibraryKey) {
    try {
      await activateCriterion({ orgId, libraryKey })
      toast.success(tToast("criterionActivated"))
      // One criterion per visit: the card the reader just chose animates into
      // the column behind the dialog, and leaving the list open on top of it
      // would hide the only confirmation that anything happened.
      setOpen(false)
    } catch (error) {
      errorToast(error)
    } finally {
      addingRef.current.delete(libraryKey)
      setAddingKeys([...addingRef.current])
    }
  }

  // Claims a criterion for an add, or refuses because that same criterion is
  // already on its way in.
  function beginAdd(libraryKey: CriteriaLibraryKey) {
    if (addingRef.current.has(libraryKey)) return
    addingRef.current.add(libraryKey)
    setAddingKeys([...addingRef.current])
    void runAdd(libraryKey)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            // The chapter carries four of these; "Add criterion" alone would
            // leave a screen reader with four identical buttons.
            aria-label={tCriteria("addLabel", { dimension: dimensionName })}
          />
        }
      >
        {tCriteria("addCta")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { dimension: dimensionName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {entries.map((key) => {
              const overlaps = overlapsSelected(key)
              const recommended = recommendedKeys.includes(key)
              return (
                <Item
                  key={key}
                  variant="outline"
                  // A real list item: the rows are a list, and Item's default
                  // div would leave an orphan in one.
                  render={<li />}
                >
                  <ItemContent>
                    {/* line-clamp-none: a clipped criterion NAME is the one
                        thing a picker must never show, and the longest library
                        names run past one line in fi. */}
                    <ItemTitle className="line-clamp-none">
                      {content.criteria[key].name}
                    </ItemTitle>
                    <ItemDescription>
                      {content.criteria[key].shortUiText}
                    </ItemDescription>
                    {(recommended || overlaps.length > 0) && (
                      <span className="flex flex-wrap gap-1">
                        {recommended && (
                          <Badge variant="secondary">
                            {tCriteria("recommendedChip")}
                          </Badge>
                        )}
                        {overlaps.length > 0 && (
                          // Badge ships one line high and clipped, which is
                          // right for a status word and wrong for a chip naming
                          // two criteria: it would cut the second name off with
                          // no ellipsis. Allowed to wrap here, and only here.
                          //
                          // The amber tint is a call-site override (the design
                          // system has no warning variant): this chip is the one
                          // thing on the row the reader has to weigh, and beside
                          // a filled recommendation chip a plain outline reads
                          // as the quieter of the two.
                          <Badge
                            variant="outline"
                            className="h-auto whitespace-normal border-amber-500/50 text-amber-700 dark:text-amber-400"
                          >
                            {tCriteria("overlapChip", {
                              // Joined by the locale's own list rules rather
                              // than a comma we picked: a criterion name can
                              // itself contain "and".
                              names: formatNames(locale, overlaps),
                            })}
                          </Badge>
                        )}
                      </span>
                    )}
                  </ItemContent>
                  {/* self-start because Item centres its slots and a row with
                      chips runs several lines tall: the add control belongs on
                      the criterion's own line. */}
                  <ItemActions className="self-start">
                    <Button
                      type="button"
                      size="sm"
                      // The dialog carries a list of these; "Add" alone would
                      // leave a screen reader with a column of identical
                      // buttons.
                      aria-label={t("addRowLabel", {
                        name: content.criteria[key].name,
                      })}
                      disabled={addingKeys.includes(key)}
                      onClick={() => beginAdd(key)}
                    >
                      {t("addRowCta")}
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
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
