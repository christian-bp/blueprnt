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
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { WeightPointRow } from "@/components/model/weight-point-row"

// A criterion the org has chosen, as it sits inside its dimension's zone.
//
// Everything the model decides about a criterion is on the card: which
// criterion, how heavily it counts, what share of the model that comes to, and
// the one way back out. What is deliberately NOT here is the 1-5 evaluation
// scale: the weighting is also 1-5, and the two side by side is exactly the
// "is this scale the weight?" confusion the surfaces were split to end. The
// anchors belong to rating a role, and they render there.
export function PlacedCriterionCard({
  criterion,
  weight,
  share,
  removing,
  disabled,
  layoutId,
  onWeightChange,
  onRemove,
}: {
  criterion: { criterionId: string; name: string }
  weight: number
  // The derived percent share of the model's total weight, already formatted
  // for the locale (ADR-0004: a display value, never an input).
  share: string
  // The removal is in flight.
  removing?: boolean
  // The allocation is being saved: the weight row refuses input rather than
  // taking edits that the batch about to land would overwrite.
  disabled?: boolean
  // Shared with the library card of the same criterion, so the card MORPHS
  // into the zone rather than appearing here while the other vanishes there.
  // Undefined leaves the card inert: with no partner id there is no layout
  // animation, and nothing on it moves.
  layoutId?: string
  onWeightChange: (points: number) => void
  onRemove: () => Promise<void> | void
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const tBuilder = useTranslations("dashboard.model.builder")
  const tChange = useTranslations("dashboard.model.change")
  const [confirmRemove, setConfirmRemove] = useState(false)
  // A layout-animated box FLIPs its size with a scale transform, and plain
  // children inherit that scale raw, which stretches text and icons for the
  // length of the morph (ui-animation.md rule 1). The direct children carry
  // the counter-transform exactly while a shared id is wired.
  const childLayout = layoutId === undefined ? false : "position"

  return (
    <motion.li layoutId={layoutId} className="rounded-md border bg-card p-3">
      {/* The name and the row's actions on one line, with the trigger always
          rendered rather than revealed on hover, so nothing appears or moves
          as the pointer crosses the card. */}
      <motion.div
        layout={childLayout}
        className="flex items-start justify-between gap-2"
      >
        {/* pt-1.5 sets the name on the icon button's first-line optical
            centre: the button's box is taller than a line of text, so at
            items-start the two would not read as one row. */}
        <span className="min-w-0 flex-1 truncate pt-1.5 font-medium text-sm">
          {criterion.name}
        </span>
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
                className="-mt-1 -mr-1 shrink-0 text-muted-foreground hover:text-foreground"
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
      </motion.div>

      <motion.div layout={childLayout} className="mt-2">
        <WeightPointRow
          name={criterion.name}
          value={weight}
          disabled={disabled}
          onChange={onWeightChange}
        />
      </motion.div>

      {/* A single constant-height line, so no height needs reserving: changing
          the weight only changes the percentage in place. */}
      <motion.p
        layout={childLayout}
        className="mt-1.5 text-muted-foreground text-xs"
      >
        <span className="font-medium text-foreground tabular-nums">
          {share}
        </span>{" "}
        {tBuilder("shareOfTotal")}
      </motion.p>

      {/* Removal deletes the criterion's ratings on every role and
          redistributes its weight points, so it confirms in a dialog rather
          than inline. It portals out, so nothing of it sits in this card. */}
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
    </motion.li>
  )
}
