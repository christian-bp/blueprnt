"use client"

import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  CRITERIA_LIBRARY_KEYS,
  type CriteriaLibraryKey,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
  LIBRARY_OVERLAP_PAIRS,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { DIMENSION_MAX_ACTIVE, type DimensionKey } from "@workspace/core"
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
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import { HelpMorphButton } from "@/components/help-morph-button"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { formatNames } from "@/lib/list-format"
import { modelErrorKey } from "@/lib/model-errors"
import { SPRING } from "@/lib/motion"
import { toast } from "@/lib/toast"

// A criterion the org has already chosen, as this dialog needs to know it:
// which library entry it is (so the row is not offered twice) and what it is
// called (so an overlap can be named rather than counted).
interface SelectedCriterion {
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
  const tHelp = useTranslations("dashboard.help")
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
  // One card's depth at a time. The list is a comparison, and four cards open
  // at once turns it back into the wall of prose the collapsed face exists to
  // prevent.
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const detailBaseId = useId()

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

  // How much room the dimension has left, in the chapter's own words: the
  // column behind the dialog carries the same chip from the same key, and a
  // reader deciding inside the dialog should not have to close it to see how
  // many slots are left. Derived from `selected`, so the two can never
  // disagree about what is chosen.
  const placedInDimension = CRITERIA_LIBRARY_KEYS.filter(
    (key) => LIBRARY_DIMENSION[key] === dimensionKey && selectedKeys.has(key)
  ).length

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
      {/* The column's last row rather than a button standing on the page: a
          quiet full-width ghost control, plus icon first, that reads as "one
          more line here" instead of competing with the criterion cards above
          it. */}
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // The chapter carries four of these; "Add criterion" alone would
            // leave a screen reader with four identical buttons.
            aria-label={tCriteria("addLabel", { dimension: dimensionName })}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          />
        }
      >
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" />
        {tCriteria("addCta")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t("title", { dimension: dimensionName })}
            <Badge variant="secondary">
              {tCriteria("columnCount", {
                count: placedInDimension,
                max: DIMENSION_MAX_ACTIVE[dimensionKey],
              })}
            </Badge>
            <HelpMorphButton label={tHelp("criterionSelectionLabel")}>
              {tHelp("criterionSelectionBody")}
            </HelpMorphButton>
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {entries.map((key) => {
              const overlaps = overlapsSelected(key)
              const recommended = recommendedKeys.includes(key)
              const entry = content.criteria[key]
              const detailOpen = detailKey === key
              const detailPanelId = `${detailBaseId}-${key}`
              return (
                <Item
                  key={key}
                  variant="outline"
                  // The Item family's default size, like the card this row
                  // becomes: a criterion the reader picks here and then finds
                  // in its column has to read as the same object, and a
                  // denser row here would make the pick and its result two
                  // different things. The dialog scrolls, so the extra height
                  // costs rows on screen, not reachability.
                  //
                  // A real list item: the rows are a list, and Item's default
                  // div would leave an orphan in one.
                  render={<li />}
                >
                  <ItemContent>
                    {/* line-clamp-none: a clipped criterion NAME is the one
                        thing a picker must never show, and the longest library
                        names run past one line in fi. */}
                    <ItemTitle className="line-clamp-none">
                      {entry.name}
                    </ItemTitle>
                    {/* The one-liner, with the depth one press away. The list
                        is a COMPARISON: four full definitions stacked make it
                        a wall of prose nobody reads to the end, so the
                        collapsed face stays scannable (name, one line, chips)
                        and the expanded face carries what the decision
                        actually needs. line-clamp-none overrides
                        ItemDescription's default two-line clamp; the one-liner
                        runs past two lines in fi and must not clip. */}
                    <ItemDescription className="line-clamp-none">
                      {entry.shortUiText}
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
                            className={cn(
                              "h-auto whitespace-normal",
                              WARNING_ALERT_CLASS
                            )}
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
                    {/* The decision material (masterdokument 11): the full
                        definition, where the criterion fits and where it does
                        not, and the control question. Behind a press, always
                        present so no row changes height on hover. */}
                    <DisclosureToggle
                      label={t("detailToggle")}
                      open={detailOpen}
                      panelId={detailPanelId}
                      onToggle={() =>
                        setDetailKey((openKey) =>
                          openKey === key ? null : key
                        )
                      }
                      className="self-start"
                    />
                    <AnimatePresence initial={false}>
                      {detailOpen ? (
                        <motion.div
                          id={detailPanelId}
                          key="detail"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={SPRING}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1 text-sm leading-relaxed">
                            <p>{entry.fullDefinition}</p>
                            <p>
                              <span className="font-medium">
                                {`${t("suitableLabel")}: `}
                              </span>
                              <span className="text-muted-foreground">
                                {entry.whenSuitable}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium">
                                {`${t("notSuitableLabel")}: `}
                              </span>
                              <span className="text-muted-foreground">
                                {entry.whenNotSuitable}
                              </span>
                            </p>
                            {/* A question the reader answers in their own
                                head. Deliberately not a field and not a gate
                                (deviation 6: activation stays one press): a
                                checkbox here would turn a moment of thought
                                into a click people learn to make without
                                thinking. Boxed so it reads as the self-test
                                rather than a fourth paragraph. */}
                            <p className="rounded-md border bg-muted/40 p-2">
                              <span className="font-medium">
                                {`${t("controlQuestionLabel")}: `}
                              </span>
                              {entry.controlQuestion}
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
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
                        name: entry.name,
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
