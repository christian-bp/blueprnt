"use client"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import NumberFlow from "@number-flow/react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { WeightPointRow } from "@/components/model/weight-point-row"
import { RemoveConfirm } from "@/components/remove-confirm"
import { SPRING } from "@/lib/motion"
import { SHARE_FORMAT } from "@/lib/weighting"

// The criterion's weight, as the Viktning chapter hands it to the card. Absent
// on the Kriterier chapter, where the card is the selection and nothing else:
// putting the 1-5 weight row beside a criterion the reader is still deciding
// to INCLUDE was the confusion the chapters exist to end.
export interface PlacedCriterionWeight {
  points: number
  // The derived share of the model's total weight, as a FRACTION (ADR-0004: a
  // display value, never an input). A number rather than formatted text
  // because it changes while the reader watches, so it renders through
  // NumberFlow; the formatting lives with the shares' one source
  // (lib/weighting.ts SHARE_FORMAT).
  share: number
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

  return (
    // Enter and leave are real transitions (a criterion genuinely arrives in
    // and leaves the column), so they animate. No layoutId and no `layout`:
    // there is no second card for this one to morph out of, and a FLIP nothing
    // needs would only put ui-animation.md rule 1's scale correction back on
    // every child.
    //
    // The Item family's DEFAULT size, no deviation: with the section running
    // the full viewport width the small variant under-read, and the picker
    // rows a criterion is chosen from are default too, so the same criterion
    // reads the same in both places. Both card variants take it together.
    <Item
      variant="outline"
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
        {/* No type-size override: the description takes ItemDescription's
            own text-sm at this Item size. */}
        <ItemDescription className="line-clamp-none">
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
            {/* ONE line under the row, carrying the SHARE alone: the row's
                fill already says which of the five points is set, and
                repeating it here made the reader read one allocation twice.
                What the row cannot say is what those points come to against
                the model's total, which is the derived figure (ADR-0004).
                A single constant-height line, so no height needs reserving:
                changing the weight only changes the figure in place, and it
                rolls rather than swaps because it moves while the reader
                watches. */}
            <p className="text-muted-foreground text-xs tabular-nums">
              {t.rich("criterionShare", {
                share: () => (
                  <span className="font-medium text-foreground">
                    <NumberFlow value={weight.share} format={SHARE_FORMAT} />
                  </span>
                ),
              })}
            </p>
          </>
        )}
      </ItemContent>

      {onRemove !== undefined && (
        // The shared inline remove morph, the same affordance the family
        // review table uses: a ghost trashcan in a fixed-size slot that arms
        // into a confirm pill anchored to the slot's right edge, so the
        // confirmation overlays the card leftwards and reflows nothing.
        //
        // self-start because Item centres its slots and the content here is
        // several lines tall: the control belongs on the title's line, not
        // halfway down the card. The trigger is always rendered rather than
        // revealed on hover, so nothing appears or moves as the pointer
        // crosses the card.
        //
        // The confirm label names the object rather than saying "Delete", the
        // same way the criterion rows on the method surface do: removal takes
        // the criterion's ratings off every role and redistributes its weight
        // points, so the second press has to read as that decision.
        <ItemActions className="self-start">
          <RemoveConfirm
            triggerLabel={tEditor("removeLabel", { name: criterion.name })}
            confirmLabel={tEditor("removeConfirm")}
            cancelLabel={tChange("cancel")}
            disabled={removing}
            onConfirm={onRemove}
          />
        </ItemActions>
      )}
    </Item>
  )
}
