"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
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
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"
import type { Variants } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// The criterion row of the method surface: the method panel's documentation
// list, mirrored by CriterionListSkeleton while that list loads. It stays a
// shared component rather than folding into the panel because the skeleton has
// to measure identical to it, and a row whose box lives in one file cannot
// drift from a placeholder built against it.
//
// Zero-layout-shift design: a single bordered row keeps the same box in every
// state. State changes reveal controls outside the row's layout box; nothing
// resizes its neighbors.
//
//   - The weight slot is a fixed-size right-aligned container that renders the
//     weight control filling the slot. It is omitted entirely where the
//     surface carries no weighting (importanceNode undefined).
//   - The note slot is a reserved-height block below the main row, carrying a
//     criterion's share of the model. Its height is reserved so a changed
//     figure never reflows neighboring rows.
//   - The row actions are a trailing dropdown menu in an ALWAYS-reserved fixed
//     slot right of the importance slot, so a row that gains or loses its
//     actions never reflows.
//   - The gap between items is marginBottom: 12 on the motion.li (animated to
//     0 on exit so the gap collapses with the height). Consumers must not
//     apply space-y or gap on the ul.

// Variants for the outer motion.li so the exit state can carry its own
// per-property transition (staged: fade then collapse) while the enter
// (animate) state uses a uniform spring.
const rowVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginBottom: 12,
    transition: SPRING,
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      opacity: { duration: 0.12 },
      height: { ...SPRING, delay: 0.1 },
      marginBottom: { ...SPRING, delay: 0.1 },
    },
  },
}

// Props:
//   name             - criterion display name
//   description      - optional muted subtitle
//   importanceNode   - the weight control; omit to hide the weight slot
//                      entirely
//   note             - optional reserved-height block below the row (the
//                      criterion's share of the model)
//   editable         - when false: no row menu (Remove)
//   onRemove         - called with no args after the user confirms inline
//   removing         - disables the button while the delete mutation is in flight
export function CriterionItem({
  name,
  description,
  extendedDescription,
  importanceNode,
  note,
  editable,
  onRemove,
  removing,
}: {
  name: string
  // Optional muted subtitle (the short description).
  description?: string
  // The criterion's extended description: when given, a morph help icon next to
  // the name reveals it (the panel is titled by the criterion name). The short
  // `description` stays inline as the subtitle.
  extendedDescription?: string
  // The row's weight control, where the surface has one.
  importanceNode?: ReactNode
  // Reserved-height content below the main row (the criterion's share).
  note?: ReactNode
  editable: boolean
  // The row action, rendered as a one-item dropdown menu while editable:
  // onRemove (behind an AlertDialog confirmation) deletes the criterion.
  // Library-only selection (decision 8): there is no edit-text action left.
  onRemove?: () => void
  removing?: boolean
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const tChange = useTranslations("dashboard.model.change")

  const showMenu = editable && onRemove !== undefined
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    // Outer motion.li carries ONLY animated geometry: layout spring for
    // siblings, height/marginBottom collapse on exit, and opacity fade.
    // It intentionally has no padding, border, min-height, or rounded classes.
    // Without those box properties the exit animation reaches a true height of
    // 0 (nothing clamps it), so AnimatePresence's unmount is a no-op and the
    // page never jumps.
    //
    // Exit staging: fade out quickly first (0.12 s), then collapse the
    // now-invisible shell after a 0.1 s delay. Because the inner div is already
    // transparent when height shrinks, content that momentarily overflows the
    // li boundary is invisible, so overflow-hidden is not needed on the li at
    // rest (adding it would clip the corner button's -top-2.5 overlap).
    //
    // Variants are used so the exit state can carry its own per-property
    // transition without affecting the enter (animate) transition.
    <motion.li
      layout
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Inner div owns all visual box styling and is the positioning context
          for anything this row anchors absolutely. The group/relative classes
          live here so a hover reveal and an absolute corner overlap are
          unchanged from the consumer's perspective. This row confirms in an
          AlertDialog, not the inline RemoveConfirm morph: its menu closes as
          the item is chosen, so there is no trigger left in the row for a
          morph to expand out of. */}
      <div className="group relative rounded-md border p-3">
        <div className="flex min-h-9 items-center gap-3">
          {/* Name + description take all remaining space and stay
              truncation-safe. The extended description sits behind the morph
              help icon next to the name (always present when given, so it adds
              no layout shift); the short description stays inline as the
              subtitle. The help panel is titled by the criterion name, like the
              concept help on the page heading. */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">{name}</span>
              {extendedDescription && (
                <HelpMorphButton label={name}>
                  {extendedDescription}
                </HelpMorphButton>
              )}
            </span>
            {description && (
              <span className="truncate text-muted-foreground text-sm">
                {description}
              </span>
            )}
          </span>

          {/* Fixed-size weight slot (w-52): holds a 1-5 weight control when the
              surface has one. Omitted where the row carries no weighting at
              all, so the slot never sits empty. */}
          {importanceNode !== undefined && (
            <span className="flex h-9 w-52 shrink-0 items-center justify-end">
              {importanceNode}
            </span>
          )}

          {/* Actions slot, rendered only while editable so the importance
              column sits flush with the row edge in read mode. Entering
              edit is a full mode switch that already swaps the weight
              control, so the column moving left with the menu is part of
              that one deliberate relayout, not a hover/state shift. Within
              edit mode the slot stays reserved when the menu has no
              actions. */}
          {editable &&
            (showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={removing}
                      aria-label={tEditor("rowMenuLabel", { name })}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onRemove !== undefined && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setConfirmRemove(true)}
                    >
                      {tEditor("removeCta")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span aria-hidden="true" className="size-9 shrink-0" />
            ))}
        </div>

        {/* Optional below-row note (Weight phase: the derived share). A single
            constant-height line, so no reserved height is needed: changing the
            weight only changes the percentage in place, never the line count. */}
        {note !== undefined && (
          <div className="mt-1 text-muted-foreground text-xs">{note}</div>
        )}

        {/* Destructive confirmation in an AlertDialog (the standard pattern
            for irreversible actions): removal deletes the criterion's
            ratings on every role and redistributes its weight points. */}
        <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {tEditor("removeDialogTitle", { name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {tEditor("removeDialogDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>
                {tChange("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={removing}
                onClick={async () => {
                  await onRemove?.()
                  setConfirmRemove(false)
                }}
              >
                {tEditor("removeConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.li>
  )
}
