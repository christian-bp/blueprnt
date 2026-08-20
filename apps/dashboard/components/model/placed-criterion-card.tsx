"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { WeightPointRow } from "@/components/model/weight-point-row"
import { SPRING } from "@/lib/motion"

// The criterion's weight, as the Viktning chapter hands it to the card. Absent
// on the Kriterier chapter, where the card is the selection and nothing else:
// putting the 1-5 weight row beside a criterion the reader is still deciding
// to INCLUDE was the confusion the chapters exist to end.
export interface PlacedCriterionWeight {
  points: number
  // The derived percent share of the model's total weight, already formatted
  // for the locale (ADR-0004: a display value, never an input).
  share: string
  onChange: (points: number) => void
}

// The Kriterier chapter's card: the criterion is IN the model, and the one
// thing that chapter decides about it is whether it stays.
interface SelectionCard {
  onRemove: () => Promise<void> | void
  // The removal is in flight.
  removing?: boolean
  weight?: never
  disabled?: never
}

// The Viktning chapter's card: how much the criterion counts. It carries no
// way out, because changing WHICH criteria are in the model is the Kriterier
// chapter's job and this chapter only distributes points among them.
interface WeightCard {
  weight: PlacedCriterionWeight
  // The allocation is being saved: the weight row refuses input rather than
  // taking edits that the batch about to land would overwrite.
  disabled?: boolean
  onRemove?: never
  removing?: never
}

// A criterion the org has chosen, in its dimension's column.
//
// Built on the design system's Item, so a criterion reads the same wherever it
// is listed: its name is the ItemTitle, the library's one-liner is the
// ItemDescription, and whatever the chapter decides about it goes in the
// content area or the actions slot.
//
// One component with one exclusive block rather than two cards: the box, the
// name row and the enter/leave transition are identical in both chapters, and
// two files carrying that markup would drift the moment either is touched. The
// union is what keeps the two chapters honest: a card cannot carry both a
// weight row and a way out, and it cannot carry neither.
//
// What is deliberately never here is the 1-5 EVALUATION scale: the weighting
// is also 1-5, and the two side by side is exactly the "is this scale the
// weight?" confusion the section was restructured to end. The anchors belong
// to rating a role, and they render there.
export function PlacedCriterionCard(
  props: {
    criterion: {
      criterionId: string
      name: string
      // The library's one-liner for the criterion, in the reader's language.
      shortUiText: string
    }
  } & (SelectionCard | WeightCard)
) {
  const { criterion, weight, removing, disabled, onRemove } = props
  const t = useTranslations("dashboard.model.weighting")
  const tEditor = useTranslations("dashboard.model.editor")
  const tChange = useTranslations("dashboard.model.change")
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    // Enter and leave are real transitions (a criterion genuinely arrives in
    // and leaves the column), so they animate. No layoutId and no `layout`:
    // there is no second card for this one to morph out of, and a FLIP nothing
    // needs would only put ui-animation.md rule 1's scale correction back on
    // every child.
    //
    // size="sm" because these sit four columns across: the default size's
    // padding is written for a full-width list.
    <Item
      variant="outline"
      size="sm"
      // The card is a real list item inside the column's own <ul>; Item's
      // default div would leave an orphan in a list.
      render={
        <motion.li
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={SPRING}
        />
      }
    >
      <ItemContent>
        {/* line-clamp-none on both: naming the criterion is the whole job of
            this card, and a four-column grid cuts a real library name in half
            ("Kunskapsdjup och speciali...") and a real one-liner off at its
            second line. They wrap instead. */}
        <ItemTitle className="line-clamp-none">{criterion.name}</ItemTitle>
        <ItemDescription className="line-clamp-none text-xs">
          {criterion.shortUiText}
        </ItemDescription>
        {weight !== undefined && (
          <>
            <WeightPointRow
              name={criterion.name}
              value={weight.points}
              disabled={disabled}
              onChange={weight.onChange}
            />
            {/* A single constant-height line, so no height needs reserving:
                changing the weight only changes the percentage in place. */}
            <p className="text-muted-foreground text-xs">
              <span className="font-medium text-foreground tabular-nums">
                {weight.share}
              </span>{" "}
              {t("shareOfTotal")}
            </p>
          </>
        )}
      </ItemContent>

      {onRemove !== undefined && (
        // self-start because Item centres its slots and the content here is
        // several lines tall: a row-actions trigger belongs on the title's
        // line, not halfway down the card.
        // The trigger is always rendered rather than revealed on hover, so
        // nothing appears or moves as the pointer crosses the card.
        <ItemActions className="self-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={removing}
                  aria-label={tEditor("rowMenuLabel", { name: criterion.name })}
                  // Pulled back into the card's padding so the icon, not the
                  // button's larger hit box, lines up with the card's corner.
                  className="-mt-1 -mr-1 text-muted-foreground hover:text-foreground"
                />
              }
            >
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmRemove(true)}
              >
                {tEditor("removeCta")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      )}

      {/* Removal deletes the criterion's ratings on every role and
          redistributes its weight points, so it confirms in a dialog rather
          than inline. It portals out, so nothing of it sits in this card. */}
      {onRemove !== undefined && (
        <ConfirmDeleteDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={tEditor("removeDialogTitle", { name: criterion.name })}
          description={tEditor("removeDialogDescription")}
          confirmLabel={tEditor("removeConfirm")}
          cancelLabel={tChange("cancel")}
          pending={removing}
          onConfirm={onRemove}
        />
      )}
    </Item>
  )
}
