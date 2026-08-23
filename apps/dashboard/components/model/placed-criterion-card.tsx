"use client"

import { Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"
import { cn } from "@workspace/ui/lib/utils"
import NumberFlow from "@number-flow/react"
import { motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import {
  type ComplianceStatus,
  isDocumentationComplete,
  MethodStatusMark,
} from "@/components/model/method-status-mark"
import { WeightPointRow } from "@/components/model/weight-point-row"
import { RemoveConfirm } from "@/components/remove-confirm"
import { WARNING_TEXT_CLASS } from "@/lib/alert-tone"
import { formatNames } from "@/lib/list-format"
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

// The criterion's documentation, as the Metod chapter hands it to the card:
// where the protokoll stands, whether the reader still owes the model an
// overlap note, and the way into the dialog that answers both.
export interface MethodCriterionDocumentation {
  status: ComplianceStatus
  // The criteria this one still has an unreviewed overlap against, by name.
  // Named rather than counted, and shown on the CARD, because the note that
  // clears it is written behind this card's own action: the checklist two
  // chapters later can only say that some pair is unreviewed, and the reader
  // then has to work out which of six criteria to open.
  partners: readonly string[]
  // Opening the documentation dialog. Absent for an editor: the dialog is a
  // write surface end to end, so the entry point is not offered at all, while
  // the status and the flag still say where the criterion stands.
  onDocument?: () => void
}

// The Kriterier chapter's card: the criterion is IN the model, and the one
// thing that chapter decides about it is whether it stays.
interface SelectionCard {
  onRemove: () => Promise<void> | void
  // The removal is in flight.
  removing?: boolean
  weight?: never
  disabled?: never
  documentation?: never
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
  documentation?: never
}

// The Metod chapter's card: the criterion's rationale and bias review. It
// carries no weight row and no way out for the same reason the other two carry
// only their own decision, and its own decision (is this documented, is the
// overlap noted) lives in the footer where every card in the column puts it.
interface MethodCard {
  documentation: MethodCriterionDocumentation
  weight?: never
  disabled?: never
  onRemove?: never
  removing?: never
}

// A criterion the org has chosen, in its dimension's column.
//
// The kanban-card surface inside the muted dimension column: white, softly
// shadowed, brightening its border on hover exactly like the deal cards this
// pattern mirrors. Shared with the method panel's placeholder so the loading
// card can never drift from the loaded one.
export const CRITERION_CARD_SURFACE =
  "bg-card shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm"

// Built on the design system's Item, so a criterion reads the same wherever it
// is listed: its name is the ItemTitle, the library's one-liner is the
// ItemDescription, and whatever the chapter decides about it goes in the
// content area or the actions slot.
//
// One component with one exclusive block rather than three cards: the box, the
// name row and the enter/leave transition are identical in all three chapters,
// and three files carrying that markup would drift the moment any of them is
// touched. The union is what keeps the chapters honest: a card carries exactly
// one chapter's decision, never two of them and never none.
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
  } & (SelectionCard | WeightCard | MethodCard)
) {
  const { criterion, weight, removing, disabled, onRemove, documentation } =
    props
  const t = useTranslations("dashboard.model.weighting")
  const tEditor = useTranslations("dashboard.model.editor")
  const tChange = useTranslations("dashboard.model.change")
  const tMethod = useTranslations("dashboard.model.method")
  const locale = useLocale()

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
      className={CRITERION_CARD_SURFACE}
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
              {t.rich("shareOfWeight", {
                share: () => (
                  <span className="font-medium text-foreground">
                    <NumberFlow value={weight.share} format={SHARE_FORMAT} />
                  </span>
                ),
              })}
            </p>
          </>
        )}
        {/* The overlap the Godkännande checklist calls "unreviewed", said on
            the card that can answer it: the dialog behind this card's action
            carries the overlap field, and writing a note on EITHER member of
            the pair clears the check. It sits under the one-liner rather than
            in the footer because it describes the criterion, while the footer
            is where the reader acts. */}
        {documentation !== undefined && documentation.partners.length > 0 && (
          <p className={cn("flex items-start gap-1", WARNING_TEXT_CLASS)}>
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {tMethod("overlapFlag", {
              names: formatNames(locale, documentation.partners),
            })}
          </p>
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
        // The confirm label names the object rather than saying "Delete":
        // removal takes the criterion's ratings off every role and
        // redistributes its weight points, so the second press has to read
        // as that decision.
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

      {documentation !== undefined && (
        // A footer row rather than the trailing ItemActions slot the Kriterier
        // card uses: that slot holds one icon, while this chapter's card has a
        // status to state as well as an action to offer, and both of them
        // beside a wrapping title would leave the name (the thing the card
        // exists to say) a narrow strip in a four-column grid. basis-full puts
        // them on their own line, where the status reads from the left of
        // every card in the column and the action sits where a dialog's
        // primary action always does.
        <ItemFooter>
          {/* The left slot is always here, empty or not: with one child a
              justify-between row would pull the action across to the left, and
              the actions in a column would then sit at two different edges
              depending on how far each criterion's documentation had got. */}
          <span className="flex min-w-0 items-center">
            {/* Nothing at all until the documentation is complete. Absence is
                the unstarted state's whole reading, and a word for "not
                started" on every card of a fresh model is six sentences
                saying the model is new. */}
            {isDocumentationComplete(documentation.status) && (
              <MethodStatusMark
                status={documentation.status}
                label={tMethod(`status.${documentation.status}`)}
              />
            )}
          </span>
          {documentation.onDocument !== undefined && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={documentation.onDocument}
            >
              {/* What is left to do, which is not the same thing once there
                  is something written: "document" is an errand, "change" is
                  an edit, and a card offering to document what it has just
                  said is documented reads as a contradiction. */}
              {tMethod(
                isDocumentationComplete(documentation.status)
                  ? "editCta"
                  : "openCta"
              )}
            </Button>
          )}
        </ItemFooter>
      )}
    </Item>
  )
}
