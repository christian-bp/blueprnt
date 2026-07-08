"use client"

import { ArrowDown01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
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
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useId, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// Shared criterion row used by both the model review screen (editable or
// read-only depending on the edit toggle) and the scratch editor (always
// editable). Keeps the row markup in one place so both surfaces stay in sync.
//
// Zero-layout-shift design: a single bordered row keeps the same box in read
// and edit mode. State changes reveal controls outside the row's layout box;
// nothing resizes its neighbors.
//
//   - The weight slot is a fixed-size right-aligned container that renders the
//     weight control filling the slot. It is omitted entirely on the Define
//     phase (importanceNode undefined), where weighting is not shown at all.
//   - The note slot is a reserved-height block below the main row, used by the
//     Weight phase for the selected level's meaning and share. Its height is
//     reserved so changing the weight (and its meaning text) never reflows
//     neighboring rows.
//   - The remove affordance is the shared RemoveConfirm (ghost trashcan that
//     morphs to an inline confirm pill, same as the onboarding family rows),
//     sitting in an ALWAYS-reserved fixed slot right of the importance slot,
//     so toggling edit mode or the removal floor never reflows the row.
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
//   importanceNode   - the weight control (Weight phase); omit to hide the
//                      weight slot entirely (Define phase)
//   note             - optional reserved-height block below the row (Weight
//                      phase: the selected level's meaning and share)
//   anchorsCaption   - optional caption shown inside the expanded scale, tying
//                      the 0-5 scale to the act of evaluating a role
//   editable         - when false: no row menu (Edit/Remove)
//   onRemove         - called with no args after the user confirms inline
//   removing         - disables the button while the delete mutation is in flight
export function CriterionItem({
  name,
  description,
  extendedDescription,
  importanceNode,
  note,
  anchors,
  anchorsCaption,
  editable,
  onEdit,
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
  // The weight control for the Weight phase; undefined on the Define phase, so
  // the 0-5 evaluation scale and the 1-5 weight control are never co-rendered.
  importanceNode?: ReactNode
  // Reserved-height content below the main row (Weight phase meaning + share).
  note?: ReactNode
  // The criterion's 0-5 anchor scale; when given, the row gets a collapsible
  // section revealing the texts (shared by onboarding and the model page).
  anchors?: { level: number; text: string }[]
  // Optional caption rendered inside the expanded scale.
  anchorsCaption?: string
  editable: boolean
  // Row actions, rendered as one dropdown menu while editable: onEdit opens
  // the text editor, onRemove (behind an AlertDialog confirmation) deletes
  // the criterion.
  onEdit?: () => void
  onRemove?: () => void
  removing?: boolean
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const tChange = useTranslations("dashboard.model.change")
  const [anchorsOpen, setAnchorsOpen] = useState(false)
  const anchorsId = useId()

  const showMenu = editable && (onEdit !== undefined || onRemove !== undefined)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const hasAnchors = anchors !== undefined && anchors.length > 0

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
          for the MorphConfirmButton corner anchor. The group/relative classes
          move here so the hover reveal and absolute corner overlap are
          unchanged from the consumer's perspective. */}
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

          {/* Fixed-size weight slot (w-52): holds the Weight phase's 1-5
              control. Omitted on the Define phase (importanceNode undefined) so
              the row is identity plus the evaluation-scale disclosure, with no
              weighting in sight. */}
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
                  {onEdit !== undefined && (
                    <DropdownMenuItem onClick={onEdit}>
                      {tEditor("editCta")}
                    </DropdownMenuItem>
                  )}
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

        {/* Collapsible anchor scale: the trigger is always present (no
            layout shift from hover/state), and expanding animates new
            content below the row, a legitimate enter. The animated element
            carries ONLY geometry (height/opacity, docs/ui-animation.md rule
            2); the list inside owns the padding. */}
        {hasAnchors && (
          <>
            <button
              type="button"
              aria-expanded={anchorsOpen}
              aria-controls={anchorsId}
              className="mt-1 flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setAnchorsOpen((open) => !open)}
            >
              {tEditor("anchors")}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  anchorsOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {anchorsOpen && (
                <motion.div
                  id={anchorsId}
                  key="anchors"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={SPRING}
                  className="overflow-hidden"
                >
                  {anchorsCaption !== undefined && (
                    <p className="pt-2 text-muted-foreground text-xs">
                      {anchorsCaption}
                    </p>
                  )}
                  <ol className="space-y-1.5 pt-2">
                    {anchors.map((anchor) => (
                      <li key={anchor.level} className="flex gap-2 text-sm">
                        <span className="w-4 shrink-0 text-right font-medium tabular-nums">
                          {anchor.level}
                        </span>
                        <span className="min-w-0 text-muted-foreground">
                          {anchor.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.li>
  )
}
