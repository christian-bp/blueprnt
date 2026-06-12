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
import { SPRING } from "@/lib/motion"

// Shared criterion row used by both the model review screen (editable or
// read-only depending on the edit toggle) and the scratch editor (always
// editable). Keeps the row markup in one place so both surfaces stay in sync.
//
// Zero-layout-shift design: a single bordered row keeps the same box in read
// and edit mode. State changes reveal controls outside the row's layout box;
// nothing resizes its neighbors.
//
//   - The importance slot is a fixed-size right-aligned container that renders
//     the static label (read mode) or the weight control filling the slot
//     (edit mode). Identical outer dimensions either way: toggling edit
//     shifts nothing.
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
//   importanceNode   - static label span (read-only) or a Select node (edit)
//   editable         - when false: no remove button; importanceNode is static
//   onRemove         - called with no args after the user confirms inline
//   removing         - disables the button while the delete mutation is in flight
//   removeLabel      - accessible aria-label for the idle cross button (e.g. "Remove Problem solving")
export function CriterionItem({
  name,
  description,
  importanceNode,
  anchors,
  editable,
  onEdit,
  onRemove,
  removing,
}: {
  name: string
  description?: string
  importanceNode: ReactNode
  // The criterion's 0-5 anchor scale; when given, the row gets a collapsible
  // section revealing the texts (shared by onboarding and the model page).
  anchors?: { level: number; text: string }[]
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
          {/* Name + description take all remaining space and stay truncation-safe. */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{name}</span>
            {description && (
              <span className="truncate text-muted-foreground text-sm">
                {description}
              </span>
            )}
          </span>

          {/* Fixed-size importance slot: identical outer box for the static
              label (read mode) and the weight control (edit mode), so
              toggling edit shifts nothing. The node is told to fill the slot
              by its parent. */}
          <span className="flex h-9 w-44 shrink-0 items-center justify-end">
            {importanceNode}
          </span>

          {/* Always-reserved actions slot: one row menu (edit / remove)
              instead of separate buttons; empty outside edit mode so the
              importance column never moves when the menu appears. */}
          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={removing}
                  aria-label={tEditor("rowMenuLabel", { name })}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit !== undefined && (
                  <DropdownMenuItem onSelect={onEdit}>
                    {tEditor("editCta")}
                  </DropdownMenuItem>
                )}
                {onRemove !== undefined && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmRemove(true)}
                  >
                    {tEditor("removeCta")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span aria-hidden="true" className="size-9 shrink-0" />
          )}
        </div>

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
