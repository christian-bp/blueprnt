"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useId, useState } from "react"
import { MorphConfirmButton } from "@/components/morph-confirm-button"
import { SPRING } from "@/lib/motion"

// Shared criterion row used by both the model review screen (editable or
// read-only depending on the edit toggle) and the scratch editor (always
// editable). Keeps the row markup in one place so both surfaces stay in sync.
//
// Zero-layout-shift design: a single bordered row keeps the same box in read
// and edit mode. State changes reveal controls outside the row's layout box;
// nothing resizes its neighbors.
//
//   - The row is `group relative` with a constant min-height (tall enough for
//     the Select). No right-padding is reserved for the delete button: the
//     importance slot sits flush right, and the delete button floats outside
//     the row's corner.
//   - The importance slot is a fixed-size right-aligned container that renders
//     the static label (read mode) or the Select filling the slot (edit mode).
//     Identical outer dimensions either way: toggling edit shifts nothing.
//   - The corner container (absolute -top-2.5 -right-2.5, z-10) uses a
//     motion.div with the `layout` prop so its width animates as a spring when
//     the content swaps between the idle X button and the armed confirm pill.
//     AnimatePresence (mode="popLayout") handles the keyed content swap with
//     opacity and scale transitions.
//     Idle: a round size-7 button with a neutral cross icon (muted-foreground).
//     Armed: the same container expands to fit a compact row of a destructive
//     confirm button and a neutral cancel icon button.
//   - The gap between items is marginBottom: 12 on the motion.li (animated to
//     0 on exit so the gap collapses with the height). Consumers must not apply
//     space-y or gap on the ul. The 12px bottom margin keeps the -top-2.5
//     (10px) corner overlap clear of the previous item's border.

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
  onRemove,
  removing,
  removeLabel,
}: {
  name: string
  description?: string
  importanceNode: ReactNode
  // The criterion's 0-5 anchor scale; when given, the row gets a collapsible
  // section revealing the texts (shared by onboarding and the model page).
  anchors?: { level: number; text: string }[]
  editable: boolean
  onRemove?: () => void
  removing?: boolean
  removeLabel?: string
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const tChange = useTranslations("dashboard.model.change")
  const [anchorsOpen, setAnchorsOpen] = useState(false)
  const anchorsId = useId()

  const showRemove = editable && onRemove !== undefined
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

          {/* Fixed-size importance slot: identical outer box for the static label
              (read mode) and the Select (edit mode), so toggling edit shifts
              nothing. The Select node is told to fill the slot by its parent. */}
          <span className="flex h-9 w-44 shrink-0 items-center justify-end">
            {importanceNode}
          </span>
        </div>

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

        {/* Morphing corner confirm: overlaps the top-right corner of the inner
            div (absolute -top-2.5 -right-2.5) so it takes no layout space.
            The corner is hidden at rest and revealed on group-hover/focus-within;
            while armed or in-flight (removing) the component forces opacity-100
            to stay visible. */}
        {showRemove && (
          <MorphConfirmButton
            triggerLabel={removeLabel ?? tEditor("removeCta")}
            confirmLabel={tEditor("removeCta")}
            cancelLabel={tChange("cancel")}
            onConfirm={async () => {
              await onRemove?.()
            }}
            disabled={removing}
            className="absolute -top-2.5 -right-2.5 z-10 opacity-0 focus-within:opacity-100 group-hover:opacity-100"
          />
        )}
      </div>
    </motion.li>
  )
}
